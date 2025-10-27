// tasks/generateCalendarEvents.js

import fs from 'fs/promises';
import path from 'path';

const PUBLIC_DIR = path.resolve(process.cwd(), 'public');
const DATA_DIR = path.join(PUBLIC_DIR, 'data');
const NAV_FILE_PATH = path.join(PUBLIC_DIR, 'nav.json');
const OUTPUT_FILE = path.join(PUBLIC_DIR, 'calendar-events.json');

async function generateCalendarEvents() {
    console.log('--- Regenerating calendar-events.json from data files ---');

    let navData;
    try {
        navData = JSON.parse(await fs.readFile(NAV_FILE_PATH, 'utf-8'));
    } catch (error) {
        console.error(
            '❌ Critical Error: Failed to load nav.json. Aborting.',
            error
        );
        process.exit(1);
    }

    const tickerInfoMap = new Map(
        navData.nav.map((item) => [item.symbol, { ...item }])
    );
    const eventsByDate = {};
    const jsonFiles = (await fs.readdir(DATA_DIR)).filter((file) =>
        file.endsWith('.json')
    );

    for (const fileName of jsonFiles) {
        // [핵심 수정] try...catch를 파일 읽기 및 파싱 부분에만 적용
        let data;
        try {
            const fileContent = await fs.readFile(
                path.join(DATA_DIR, fileName),
                'utf-8'
            );
            data = JSON.parse(fileContent);
        } catch (e) {
            // 파일 읽기/파싱 오류 시 해당 파일만 건너뛰고 계속 진행
            console.error(`Error processing ${fileName}: ${e.message}`);
            continue; // 다음 파일로 넘어감
        }

        const backtestData = data.backtestData || [];
        if (backtestData.length === 0) continue;

        const tickerSymbol = path
            .basename(fileName, '.json')
            .toUpperCase()
            .replace(/-/g, '.');
        const tickerInfo = tickerInfoMap.get(tickerSymbol);

        if (!tickerInfo || tickerInfo.upcoming) {
            continue;
        }

        const currency = tickerInfo.currency || 'USD';

        backtestData.forEach((entry) => {
            if (!entry || !entry.date) return; // entry가 null/undefined인 경우 방지

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
            } else if (entry.expected === true) {
                event.isExpected = true;
                hasEvent = true;
            } else if (entry.forecasted === true) {
                event.isForecast = true;
                hasEvent = true;
            }

            if (hasEvent) {
                if (!eventsByDate[dateStr]) eventsByDate[dateStr] = {};
                if (!eventsByDate[dateStr][currency])
                    eventsByDate[dateStr][currency] = [];

                if (
                    !eventsByDate[dateStr][currency].some(
                        (e) => e.ticker === tickerSymbol
                    )
                ) {
                    eventsByDate[dateStr][currency].push(event);
                }
            }
        });
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
}

generateCalendarEvents();
