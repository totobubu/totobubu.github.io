// tasks/generateCalendarEvents.js

import fs from 'fs/promises';
import path from 'path';
import { format, startOfDay } from 'date-fns';

const PUBLIC_DIR = path.resolve(process.cwd(), 'public');
const DATA_DIR = path.join(PUBLIC_DIR, 'data');
const NAV_FILE_PATH = path.join(PUBLIC_DIR, 'nav.json');
const OUTPUT_FILE = path.join(PUBLIC_DIR, 'calendar-events.json');

async function generateCalendarEvents() {
    console.log('--- Regenerating calendar-events.json from data files ---');
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
                const backtestData = data.backtestData || [];
                if (backtestData.length === 0) continue;

                const tickerSymbol = path
                    .basename(fileName, '.json')
                    .toUpperCase()
                    .replace(/-/g, '.');
                const tickerInfo = tickerInfoMap.get(tickerSymbol);
                if (!tickerInfo) continue;

                const currency = tickerInfo.currency || 'USD';

                backtestData.forEach((entry) => {
                    if (!entry.date) return;

                    const dateStr = entry.date;
                    const event = {
                        ticker: tickerSymbol,
                        koName: tickerInfo.koName,
                        frequency: tickerInfo.frequency,
                        group: tickerInfo.group,
                    };
                    let hasEvent = false;

                    const amount =
                        entry.amountFixed !== undefined
                            ? entry.amountFixed
                            : entry.amount;

                    if (amount !== undefined) {
                        event.amount = amount;
                        hasEvent = true;
                    } else if (entry.scheduled === true) {
                        event.isScheduled = true; // '예정' 플래그
                        hasEvent = true;
                    } else if (entry.forecasted === true) {
                        event.isForecast = true; // '예상' 플래그
                        hasEvent = true;
                    }

                    if (hasEvent) {
                        if (!eventsByDate[dateStr]) eventsByDate[dateStr] = {};
                        if (!eventsByDate[dateStr][currency])
                            eventsByDate[dateStr][currency] = [];

                        // 중복 추가 방지
                        if (
                            !eventsByDate[dateStr][currency].some(
                                (e) => e.ticker === tickerSymbol
                            )
                        ) {
                            eventsByDate[dateStr][currency].push(event);
                        }
                    }
                });
            } catch (e) {
                console.error(`Error processing ${fileName}:`, e);
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
