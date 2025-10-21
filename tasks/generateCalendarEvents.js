// tasks/generateCalendarEvents.js
import fs from 'fs/promises';
import path from 'path';
import {
    format,
    startOfDay,
    addMonths,
    addWeeks,
    addYears,
    getDay,
    nextDay,
    parseISO,
} from 'date-fns';

const PUBLIC_DIR = path.resolve(process.cwd(), 'public');
const DATA_DIR = path.join(PUBLIC_DIR, 'data');
const NAV_FILE_PATH = path.join(PUBLIC_DIR, 'nav.json');
const OUTPUT_FILE = path.join(PUBLIC_DIR, 'calendar-events.json');
const KR_HOLIDAYS_PATH = path.join(PUBLIC_DIR, 'holidays', 'kr_holidays.json');
const US_HOLIDAYS_PATH = path.join(PUBLIC_DIR, 'holidays', 'us_holidays.json');

// --- Helper Functions ---

// 휴일인지, 주말인지 확인하는 함수
function isNonTradingDay(date, holidaySet) {
    const day = getDay(date); // 0: Sunday, 6: Saturday
    if (day === 0 || day === 6) {
        return true;
    }
    return holidaySet.has(format(date, 'yyyy-MM-dd'));
}

// 다음 영업일을 찾는 함수
function getNextTradingDay(date, holidaySet) {
    let nextDate = new Date(date);
    while (isNonTradingDay(nextDate, holidaySet)) {
        nextDate.setDate(nextDate.getDate() + 1);
    }
    return nextDate;
}

// 그룹 정보를 기반으로 다음 예상 배당일 계산
function calculateNextExpectedDate(lastDividend, tickerInfo, holidaySet) {
    const { frequency, group } = tickerInfo;
    const lastDate = parseISO(lastDividend.date);

    switch (frequency) {
        case '매월':
            return addMonths(lastDate, 1);
        case '분기':
            return addMonths(lastDate, 3);
        case '매년':
            return addYears(lastDate, 1);
        case '매주':
            const dayMap = { 월: 1, 화: 2, 수: 3, 목: 4, 금: 5 };
            const targetDay = dayMap[group];
            if (targetDay) {
                // 마지막 배당일로부터 7일 뒤를 기준으로 다음 해당 요일을 찾음
                const nextWeekBase = addWeeks(lastDate, 1);
                return nextDay(nextWeekBase, targetDay);
            }
            return addWeeks(lastDate, 1); // 그룹 정보 없으면 그냥 1주 더함
        default:
            return null;
    }
}

async function generateCalendarEvents() {
    console.log('--- Regenerating calendar-events.json from backtestData ---');
    try {
        // 데이터 로드
        const navData = JSON.parse(await fs.readFile(NAV_FILE_PATH, 'utf-8'));
        const krHolidays = new Set(
            JSON.parse(await fs.readFile(KR_HOLIDAYS_PATH, 'utf-8')).map(
                (h) => h.date
            )
        );
        const usHolidays = new Set(
            JSON.parse(await fs.readFile(US_HOLIDAYS_PATH, 'utf-8')).map(
                (h) => h.date
            )
        );

        const tickerInfoMap = new Map(
            navData.nav.map((item) => [item.symbol, { ...item }])
        );

        const eventsByDate = {};
        const jsonFiles = (await fs.readdir(DATA_DIR)).filter((file) =>
            file.endsWith('.json')
        );

        for (const fileName of jsonFiles) {
            try {
                const data = JSON.parse(
                    await fs.readFile(path.join(DATA_DIR, fileName), 'utf-8')
                );
                const backtestData = data.backtestData || [];
                if (backtestData.length === 0) continue;

                const tickerSymbol = path
                    .basename(fileName, '.json')
                    .toUpperCase()
                    .replace(/-/g, '.');
                const tickerInfo = tickerInfoMap.get(tickerSymbol);
                if (!tickerInfo || tickerInfo.upcoming) continue;

                const currency = tickerInfo.currency || 'USD';
                const holidaySet = currency === 'KRW' ? krHolidays : usHolidays;

                const createEventEntry = (overrides) => ({
                    ticker: tickerInfo.symbol,
                    koName: tickerInfo.koName,
                    company: tickerInfo.company,
                    frequency: tickerInfo.frequency,
                    group: tickerInfo.group,
                    ...overrides,
                });

                // 1. 기존 확정/예상 배당일 추가
                backtestData.forEach((entry) => {
                    if (!entry.date) return;
                    const dateStr = format(
                        startOfDay(new Date(entry.date)),
                        'yyyy-MM-dd'
                    );

                    if (!eventsByDate[dateStr]) eventsByDate[dateStr] = {};
                    if (!eventsByDate[dateStr][currency])
                        eventsByDate[dateStr][currency] = [];

                    const amount =
                        entry.amountFixed !== undefined
                            ? entry.amountFixed
                            : entry.amount;
                    if (amount !== undefined) {
                        eventsByDate[dateStr][currency].push(
                            createEventEntry({ amount })
                        );
                    } else if (entry.expected === true) {
                        if (
                            !eventsByDate[dateStr][currency].some(
                                (e) => e.ticker === tickerSymbol
                            )
                        ) {
                            eventsByDate[dateStr][currency].push(
                                createEventEntry({ isForecast: true })
                            );
                        }
                    }
                });

                // 2. 미래 예상 배당일 계산 로직
                const allDividends = backtestData
                    .filter(
                        (d) =>
                            (d.amount !== undefined ||
                                d.amountFixed !== undefined) &&
                            d.date
                    )
                    .sort((a, b) => new Date(b.date) - new Date(a.date));

                if (allDividends.length > 0) {
                    let lastDividend = allDividends[0];
                    const oneYearFromNow = addYears(new Date(), 1);

                    while (true) {
                        const nextDateRaw = calculateNextExpectedDate(
                            lastDividend,
                            tickerInfo,
                            holidaySet
                        );
                        if (!nextDateRaw || nextDateRaw > oneYearFromNow) break;

                        const nextTradingDay = getNextTradingDay(
                            nextDateRaw,
                            holidaySet
                        );
                        const dateStr = format(nextTradingDay, 'yyyy-MM-dd');

                        if (!eventsByDate[dateStr]) eventsByDate[dateStr] = {};
                        if (!eventsByDate[dateStr][currency])
                            eventsByDate[dateStr][currency] = [];

                        // 이미 확정 배당이 있는 날짜에는 추가하지 않음
                        const hasConfirmedDividend = eventsByDate[dateStr][
                            currency
                        ].some(
                            (e) =>
                                e.ticker === tickerSymbol &&
                                e.amount !== undefined
                        );

                        if (!hasConfirmedDividend) {
                            if (
                                !eventsByDate[dateStr][currency].some(
                                    (e) => e.ticker === tickerSymbol
                                )
                            ) {
                                eventsByDate[dateStr][currency].push(
                                    createEventEntry({ isForecast: true })
                                );
                            }
                        }

                        // 다음 계산을 위해 마지막 배당일을 업데이트
                        lastDividend = {
                            date: format(nextTradingDay, 'yyyy-MM-dd'),
                        };
                    }
                }
            } catch (e) {
                console.error(`Error processing ${fileName}:`, e);
                continue;
            }
        }

        const sortedEventsByDate = Object.keys(eventsByDate)
            .sort()
            .reduce((acc, key) => {
                acc[key] = eventsByDate[key];
                return acc;
            }, {});

        await fs.writeFile(
            OUTPUT_FILE,
            JSON.stringify(sortedEventsByDate, null, 2)
        );
        console.log(
            `🎉 Successfully generated calendar-events.json with ${Object.keys(sortedEventsByDate).length} dates (including future events).`
        );
    } catch (error) {
        console.error('❌ Error generating calendar-events.json:', error);
        process.exit(1);
    }
}

generateCalendarEvents();
