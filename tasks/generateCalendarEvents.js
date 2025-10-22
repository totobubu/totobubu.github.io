// tasks/generateCalendarEvents.js

import fs from 'fs/promises';
import path from 'path';
// [핵심 수정] 날짜 계산을 위한 함수들 추가 import
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
} from 'date-fns';

const PUBLIC_DIR = path.resolve(process.cwd(), 'public');
const DATA_DIR = path.join(PUBLIC_DIR, 'data');
const NAV_FILE_PATH = path.join(PUBLIC_DIR, 'nav.json');
const OUTPUT_FILE = path.join(PUBLIC_DIR, 'calendar-events.json');

async function generateCalendarEvents() {
    console.log(
        '--- Regenerating calendar-events.json (with future projections) ---'
    );

    const today = startOfDay(new Date());
    const startDate = startOfYear(subYears(today, 1));
    const endDate = endOfMonth(addMonths(today, 6));

    console.log(
        `Data range: ${format(startDate, 'yyyy-MM-dd')} ~ ${format(endDate, 'yyyy-MM-dd')}`
    );

    try {
        const navData = JSON.parse(await fs.readFile(NAV_FILE_PATH, 'utf-8'));
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
                const backtestData = data.backtestData;

                if (!Array.isArray(backtestData) || backtestData.length === 0) {
                    continue;
                }

                const tickerSymbol = path
                    .basename(fileName, '.json')
                    .toUpperCase()
                    .replace(/-/g, '.');
                const tickerInfo = tickerInfoMap.get(tickerSymbol);
                if (!tickerInfo) continue;

                const currency = tickerInfo.currency || 'USD';

                const createEventEntry = (overrides) => ({
                    ticker: tickerInfo.symbol,
                    koName: tickerInfo.koName,
                    company: tickerInfo.company,
                    frequency: tickerInfo.frequency,
                    group: tickerInfo.group,
                    ...overrides,
                });

                // 1. 기존 데이터(확정/예상) 처리
                backtestData.forEach((entry) => {
                    if (!entry.date) return;
                    const eventDate = startOfDay(new Date(entry.date));

                    if (eventDate >= startDate && eventDate <= endDate) {
                        const dateStr = format(eventDate, 'yyyy-MM-dd');
                        if (!eventsByDate[dateStr]) eventsByDate[dateStr] = {};
                        if (!eventsByDate[dateStr][currency])
                            eventsByDate[dateStr][currency] = [];

                        const amount =
                            entry.amountFixed !== undefined
                                ? entry.amountFixed
                                : entry.amount;

                        // 중복 방지: 동일 날짜, 동일 티커 이벤트가 이미 있는지 확인
                        const isDuplicate = eventsByDate[dateStr][
                            currency
                        ].some((e) => e.ticker === tickerSymbol);
                        if (isDuplicate) return;

                        if (amount !== undefined) {
                            eventsByDate[dateStr][currency].push(
                                createEventEntry({ amount })
                            );
                        } else if (entry.expected === true) {
                            eventsByDate[dateStr][currency].push(
                                createEventEntry({ isForecast: true })
                            );
                        }
                    }
                });

                // --- [핵심 로직] 미래 배당일 예측 및 추가 ---
                const confirmedDividends = backtestData
                    .filter(
                        (d) =>
                            d.amount !== undefined ||
                            d.amountFixed !== undefined
                    )
                    .sort((a, b) => new Date(b.date) - new Date(a.date));

                if (confirmedDividends.length > 0) {
                    const lastConfirmedDividend = confirmedDividends[0];
                    let nextDate = startOfDay(
                        new Date(lastConfirmedDividend.date)
                    );

                    const projectFutureDates = (
                        dateIncrementFn,
                        incrementValue
                    ) => {
                        while (nextDate <= endDate) {
                            nextDate = dateIncrementFn(
                                nextDate,
                                incrementValue
                            );
                            if (nextDate > today && nextDate <= endDate) {
                                const dateStr = format(nextDate, 'yyyy-MM-dd');
                                if (!eventsByDate[dateStr])
                                    eventsByDate[dateStr] = {};
                                if (!eventsByDate[dateStr][currency])
                                    eventsByDate[dateStr][currency] = [];

                                // 이미 확정 배당이 있거나 다른 이유로 이벤트가 등록된 경우 건너뜀
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
                        }
                    };

                    switch (tickerInfo.frequency) {
                        case '매월':
                            projectFutureDates(addMonths, 1);
                            break;
                        case '매주':
                            projectFutureDates(addWeeks, 1);
                            break;
                        case '분기':
                            projectFutureDates(addQuarters, 1);
                            break;
                        case '매년':
                            projectFutureDates(addYears, 1);
                            break;
                    }
                }
                // --- 예측 로직 끝 ---
            } catch (e) {
                console.error(`Error processing ${fileName}:`, e.message);
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
            `🎉 Successfully generated calendar-events.json with ${Object.keys(sortedEventsByDate).length} dates.`
        );
    } catch (error) {
        console.error('❌ Error generating calendar-events.json:', error);
        process.exit(1);
    }
}

generateCalendarEvents();
