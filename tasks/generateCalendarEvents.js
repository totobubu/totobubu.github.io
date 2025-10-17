// tasks/generateCalendarEvents.js
import fs from 'fs/promises';
import path from 'path';
import {
    addMonths,
    nextDay,
    getDay,
    addWeeks,
    addYears,
    subMonths,
    format,
    startOfDay,
    subDays,
} from 'date-fns';

const PUBLIC_DIR = path.resolve(process.cwd(), 'public');
const DATA_DIR = path.join(PUBLIC_DIR, 'data');
const NAV_FILE_PATH = path.join(PUBLIC_DIR, 'nav.json');
const US_HOLIDAYS_PATH = path.join(PUBLIC_DIR, 'holidays', 'us_holidays.json');
const KR_HOLIDAYS_PATH = path.join(PUBLIC_DIR, 'holidays', 'kr_holidays.json');
const OUTPUT_FILE = path.join(PUBLIC_DIR, 'calendar-events.json');

const DAY_MAP = { 월: 1, 화: 2, 수: 3, 목: 4, 금: 5 };

function getPreviousWorkday(date, holidaysSet) {
    let currentDate = new Date(date);
    while (true) {
        const dayOfWeek = getDay(currentDate);
        const dateStr = format(currentDate, 'yyyy-MM-dd');
        if (dayOfWeek !== 0 && dayOfWeek !== 6 && !holidaysSet.has(dateStr)) {
            return currentDate;
        }
        currentDate = subDays(currentDate, 1);
    }
}

async function generateCalendarEvents() {
    console.log(
        '--- Regenerating calendar-events.json with country-specific holidays ---'
    );
    try {
        const navData = JSON.parse(await fs.readFile(NAV_FILE_PATH, 'utf-8'));
        const usHolidays = JSON.parse(
            await fs.readFile(US_HOLIDAYS_PATH, 'utf-8')
        );
        const krHolidays = JSON.parse(
            await fs.readFile(KR_HOLIDAYS_PATH, 'utf-8')
        );

        const usHolidaysSet = new Set(usHolidays.map((h) => h.date));
        const krHolidaysSet = new Set(krHolidays.map((h) => h.date));

        const tickerInfoMap = new Map(
            navData.nav.map((item) => [item.symbol, { ...item }])
        );

        const today = startOfDay(new Date());
        const startDate = subMonths(today, 12);
        const endDate = addMonths(today, 4);

        const jsonFiles = (await fs.readdir(DATA_DIR)).filter((file) =>
            file.endsWith('.json')
        );
        const eventsByDate = {};

        for (const fileName of jsonFiles) {
            const filePath = path.join(DATA_DIR, fileName);
            try {
                const data = JSON.parse(await fs.readFile(filePath, 'utf-8'));
                const backtestData = data.backtestData || [];
                if (backtestData.length === 0) continue;

                const tickerSymbol = path
                    .basename(fileName, '.json')
                    .toUpperCase()
                    .replace(/-/g, '.');
                const tickerInfo = tickerInfoMap.get(tickerSymbol);
                if (!tickerInfo) continue;

                let lastKnownDate = null;

                const createEventEntry = (overrides) => {
                    const baseEntry = {
                        symbol: tickerInfo.symbol,
                        koName: tickerInfo.koName,
                        company: tickerInfo.company,
                        underlying: tickerInfo.underlying,
                        frequency: tickerInfo.frequency,
                        group: tickerInfo.group,
                    };
                    return { ...baseEntry, ...overrides };
                };

                backtestData.forEach((entry) => {
                    const eventDate = new Date(entry.date);
                    if (eventDate < startDate || eventDate >= endDate) return;

                    const dateStr = entry.date;
                    const amount =
                        entry.amountFixed !== undefined
                            ? entry.amountFixed
                            : entry.amount;
                    const isExpected = entry.expected === true;

                    if (
                        (eventDate < today && amount === undefined) ||
                        (isExpected && eventDate < today)
                    )
                        return;

                    if (!eventsByDate[dateStr]) eventsByDate[dateStr] = {};
                    const currency = tickerInfo.currency || 'USD';
                    if (!eventsByDate[dateStr][currency])
                        eventsByDate[dateStr][currency] = [];

                    const eventEntry = createEventEntry({
                        amount: amount,
                        isExpected: isExpected ? true : undefined,
                    });

                    eventsByDate[dateStr][currency].push(eventEntry);

                    if (!isExpected && amount !== undefined) {
                        lastKnownDate = eventDate;
                    } else if (
                        isExpected &&
                        (lastKnownDate === null || eventDate > lastKnownDate)
                    ) {
                        lastKnownDate = eventDate;
                    }
                });

                if (lastKnownDate && tickerInfo.frequency) {
                    let nextDate = new Date(lastKnownDate);

                    // [핵심 수정] 티커의 통화에 따라 올바른 휴일 목록 선택
                    const holidaysSet =
                        tickerInfo.currency === 'KRW'
                            ? krHolidaysSet
                            : usHolidaysSet;

                    while (nextDate < endDate) {
                        if (tickerInfo.frequency === '매월')
                            nextDate = addMonths(nextDate, 1);
                        else if (tickerInfo.frequency === '분기')
                            nextDate = addMonths(nextDate, 3);
                        else if (tickerInfo.frequency === '매년')
                            nextDate = addYears(nextDate, 1);
                        else if (
                            tickerInfo.frequency === '매주' &&
                            tickerInfo.group
                        ) {
                            nextDate = nextDay(
                                nextDate,
                                DAY_MAP[tickerInfo.group]
                            );
                        } else break;

                        if (nextDate < today || nextDate >= endDate) continue;

                        // 국가별 휴일에 맞춰 영업일 조정
                        let adjustedDate = getPreviousWorkday(
                            nextDate,
                            holidaysSet
                        );
                        const dateStr = format(adjustedDate, 'yyyy-MM-dd');
                        const currency = tickerInfo.currency || 'USD';

                        const existingEvents =
                            eventsByDate[dateStr]?.[currency] || [];
                        if (
                            existingEvents.some(
                                (e) => e.symbol === tickerSymbol
                            )
                        )
                            continue;

                        if (!eventsByDate[dateStr]) eventsByDate[dateStr] = {};
                        if (!eventsByDate[dateStr][currency])
                            eventsByDate[dateStr][currency] = [];

                        eventsByDate[dateStr][currency].push(
                            createEventEntry({ isForecast: true })
                        );
                    }
                }
            } catch (e) {
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
            `🎉 Successfully generated optimized calendar-events.json with ${Object.keys(sortedEventsByDate).length} dates.`
        );
    } catch (error) {
        console.error('❌ Error generating calendar-events.json:', error);
        process.exit(1);
    }
}

generateCalendarEvents();
