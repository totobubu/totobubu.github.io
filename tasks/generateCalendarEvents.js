// CREATE NEW FILE: tasks/generateCalendarEvents.js
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
const HOLIDAYS_FILE_PATH = path.join(PUBLIC_DIR, 'holidays.json');
const OUTPUT_FILE = path.join(PUBLIC_DIR, 'calendar-events.json');

const DAY_MAP = { 월: 1, 화: 2, 수: 3, 목: 4, 금: 5 };

function getPreviousWorkday(date, holidaysSet) {
    let currentDate = new Date(date);
    while (true) {
        const dayOfWeek = getDay(currentDate);
        const dateStr = format(currentDate, 'yyyy-MM-dd');
        // 주말(토=6, 일=0)이 아니고 휴일 목록에도 없으면 영업일
        if (dayOfWeek !== 0 && dayOfWeek !== 6 && !holidaysSet.has(dateStr)) {
            return currentDate;
        }
        currentDate = subDays(currentDate, 1);
    }
}

async function generateCalendarEvents() {
    console.log(
        '--- Regenerating calendar-events.json with holiday adjustments ---'
    );

    try {
        const navData = JSON.parse(await fs.readFile(NAV_FILE_PATH, 'utf-8'));
        const holidaysData = JSON.parse(
            await fs.readFile(HOLIDAYS_FILE_PATH, 'utf-8')
        );
        const holidaysSet = new Set(holidaysData.map((h) => h.date));

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

                backtestData.forEach((entry) => {
                    const eventDate = new Date(entry.date);
                    if (eventDate < startDate || eventDate >= endDate) return;

                    const dateStr = entry.date;
                    const amount =
                        entry.amountFixed !== undefined
                            ? entry.amountFixed
                            : entry.amount;
                    const isExpected = entry.expected === true;

                    if (eventDate < today && amount === undefined) return;
                    if (isExpected && eventDate < today) return; // 과거의 expected는 무시

                    if (!eventsByDate[dateStr]) eventsByDate[dateStr] = {};
                    if (!eventsByDate[dateStr][tickerInfo.currency])
                        eventsByDate[dateStr][tickerInfo.currency] = [];

                    const eventEntry = {
                        ticker: tickerSymbol,
                        koName: tickerInfo.koName,
                        frequency: tickerInfo.frequency,
                        group: tickerInfo.group,
                    };
                    if (amount !== undefined) eventEntry.amount = amount;
                    if (isExpected) eventEntry.isExpected = true;

                    eventsByDate[dateStr][tickerInfo.currency].push(eventEntry);

                    // 예측 시작점을 찾기 위해 가장 마지막 날짜를 기록
                    if (lastKnownDate === null || eventDate > lastKnownDate) {
                        lastKnownDate = eventDate;
                    }
                });

                if (lastKnownDate && tickerInfo.frequency) {
                    let nextDate = new Date(lastKnownDate);
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

                        let adjustedDate = getPreviousWorkday(
                            nextDate,
                            holidaysSet
                        );
                        const dateStr = format(adjustedDate, 'yyyy-MM-dd');

                        const existingEvents =
                            eventsByDate[dateStr]?.[tickerInfo.currency] || [];
                        if (
                            existingEvents.some(
                                (e) => e.ticker === tickerSymbol
                            )
                        )
                            continue;

                        if (!eventsByDate[dateStr]) eventsByDate[dateStr] = {};
                        if (!eventsByDate[dateStr][tickerInfo.currency])
                            eventsByDate[dateStr][tickerInfo.currency] = [];

                        eventsByDate[dateStr][tickerInfo.currency].push({
                            ticker: tickerSymbol,
                            koName: tickerInfo.koName,
                            frequency: tickerInfo.frequency,
                            group: tickerInfo.group,
                            isForecast: true,
                        });
                    }
                }
            } catch (e) {
                continue;
            }
        }

        // [핵심 수정] 날짜순으로 최종 객체 정렬
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
            `🎉 Successfully generated sorted calendar-events.json with ${Object.keys(sortedEventsByDate).length} dates.`
        );
    } catch (error) {
        console.error('❌ Error generating calendar-events.json:', error);
        process.exit(1);
    }
}

generateCalendarEvents();
