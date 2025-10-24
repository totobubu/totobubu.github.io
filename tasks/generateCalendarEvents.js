// tasks/generateCalendarEvents.js

import fs from 'fs/promises';
import path from 'path';
import {
    format,
    startOfDay,
    subYears,
    addMonths,
    startOfYear,
    endOfMonth,
    addWeeks,
    addQuarters,
    addYears,
    subDays,
    getDay,
} from 'date-fns';

const PUBLIC_DIR = path.resolve(process.cwd(), 'public');
const DATA_DIR = path.join(PUBLIC_DIR, 'data');
const NAV_FILE_PATH = path.join(PUBLIC_DIR, 'nav.json');
const OUTPUT_FILE = path.join(PUBLIC_DIR, 'calendar-events.json');
const US_HOLIDAYS_PATH = path.join(PUBLIC_DIR, 'holidays', 'us_holidays.json');
const KR_HOLIDAYS_PATH = path.join(PUBLIC_DIR, 'holidays', 'kr_holidays.json');

function getPreviousBusinessDay(date, holidaySet) {
    let currentDate = startOfDay(date);
    while (true) {
        const dayOfWeek = getDay(currentDate);
        const dateStr = format(currentDate, 'yyyy-MM-dd');
        if (dayOfWeek !== 0 && dayOfWeek !== 6 && !holidaySet.has(dateStr)) {
            return currentDate;
        }
        currentDate = subDays(currentDate, 1);
    }
}

async function generateCalendarEvents() {
    console.log(
        '--- Regenerating calendar-events.json (with holiday adjustments) ---'
    );

    const today = startOfDay(new Date());
    const startDate = startOfYear(subYears(today, 1));
    const endDate = endOfMonth(addMonths(today, 6));
    console.log(
        `Data range: ${format(startDate, 'yyyy-MM-dd')} ~ ${format(endDate, 'yyyy-MM-dd')}`
    );

    try {
        const navData = JSON.parse(await fs.readFile(NAV_FILE_PATH, 'utf-8'));
        const usHolidays = new Set(
            JSON.parse(await fs.readFile(US_HOLIDAYS_PATH, 'utf-8')).map(
                (h) => h.date
            )
        );
        const krHolidays = new Set(
            JSON.parse(await fs.readFile(KR_HOLIDAYS_PATH, 'utf-8')).map(
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
                if (
                    !Array.isArray(data.backtestData) ||
                    data.backtestData.length === 0
                )
                    continue;

                const tickerSymbol = path
                    .basename(fileName, '.json')
                    .toUpperCase()
                    .replace(/-/g, '.');
                const tickerInfo = tickerInfoMap.get(tickerSymbol);
                if (!tickerInfo) continue;

                const currency = tickerInfo.currency || 'USD';
                const holidaySet = currency === 'KRW' ? krHolidays : usHolidays;
                const tickerEvents = new Map();

                data.backtestData.forEach((entry) => {
                    if (!entry.date) return;
                    let eventDate = startOfDay(new Date(entry.date));
                    const amount =
                        entry.amountFixed !== undefined
                            ? entry.amountFixed
                            : entry.amount;

                    if (amount !== undefined) {
                        const dateStr = format(eventDate, 'yyyy-MM-dd');
                        if (eventDate >= startDate && eventDate <= endDate) {
                            tickerEvents.set(dateStr, { amount });
                        }
                    } else if (entry.expected === true) {
                        const adjustedDate = getPreviousBusinessDay(
                            eventDate,
                            holidaySet
                        );
                        const dateStr = format(adjustedDate, 'yyyy-MM-dd');
                        if (
                            adjustedDate >= startDate &&
                            adjustedDate <= endDate &&
                            !tickerEvents.has(dateStr)
                        ) {
                            tickerEvents.set(dateStr, { isForecast: true });
                        }
                    }
                });

                // --- [핵심 수정] 예측 기준점을 '확정 배당일'과 '마지막 알려진 날짜'로 분리 ---
                const confirmedDividends = data.backtestData
                    .filter(
                        (d) =>
                            d.date &&
                            (d.amount !== undefined ||
                                d.amountFixed !== undefined)
                    )
                    .sort((a, b) => new Date(b.date) - new Date(a.date));

                const allKnownEvents = data.backtestData
                    .filter(
                        (d) =>
                            d.date &&
                            (d.amount !== undefined ||
                                d.amountFixed !== undefined ||
                                d.expected === true)
                    )
                    .sort((a, b) => new Date(b.date) - new Date(a.date));

                if (
                    confirmedDividends.length > 0 &&
                    allKnownEvents.length > 0
                ) {
                    // 예측 패턴의 기준이 되는 날짜 (항상 확정일)
                    const predictionAnchor = startOfDay(
                        new Date(confirmedDividends[0].date)
                    );
                    // 예측을 시작해야 할 날짜 (파일에 있는 마지막 날짜 이후부터)
                    const lastKnownDate = startOfDay(
                        new Date(allKnownEvents[0].date)
                    );

                    const projectFutureDates = (dateIncrementFn) => {
                        let nextProjectedDate = predictionAnchor;

                        while (true) {
                            nextProjectedDate = dateIncrementFn(
                                nextProjectedDate,
                                1
                            );

                            if (nextProjectedDate > endDate) break;

                            // 파일에 이미 있는 날짜보다 이후의 예측만 처리
                            if (
                                nextProjectedDate > lastKnownDate &&
                                nextProjectedDate > today
                            ) {
                                const adjustedDate = getPreviousBusinessDay(
                                    nextProjectedDate,
                                    holidaySet
                                );
                                const dateStr = format(
                                    adjustedDate,
                                    'yyyy-MM-dd'
                                );

                                if (!tickerEvents.has(dateStr)) {
                                    tickerEvents.set(dateStr, {
                                        isForecast: true,
                                    });
                                }
                            }
                        }
                    };

                    switch (tickerInfo.frequency) {
                        case '매월':
                            projectFutureDates(addMonths);
                            break;
                        case '매주':
                            projectFutureDates(addWeeks);
                            break;
                        case '분기':
                            projectFutureDates(addQuarters);
                            break;
                        case '매년':
                            projectFutureDates(addYears);
                            break;
                    }
                }

                for (const [dateStr, eventData] of tickerEvents.entries()) {
                    if (!eventsByDate[dateStr]) eventsByDate[dateStr] = {};
                    if (!eventsByDate[dateStr][currency])
                        eventsByDate[dateStr][currency] = [];

                    if (
                        !eventsByDate[dateStr][currency].some(
                            (e) => e.ticker === tickerSymbol
                        )
                    ) {
                        const finalEvent = {
                            ticker: tickerSymbol,
                            koName: tickerInfo.koName,
                            frequency: tickerInfo.frequency,
                            group: tickerInfo.group,
                            ...eventData,
                        };
                        if (!finalEvent.group) delete finalEvent.group;
                        eventsByDate[dateStr][currency].push(finalEvent);
                    }
                }
            } catch (e) {
                console.error(`Error processing ${fileName}:`, e.message);
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
            `🎉 Successfully generated calendar-events.json with ${Object.keys(sortedEventsByDate).length} dates.`
        );
    } catch (error) {
        console.error('❌ Error generating calendar-events.json:', error);
        process.exit(1);
    }
}

generateCalendarEvents();
