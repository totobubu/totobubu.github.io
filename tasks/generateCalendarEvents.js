// tasks\generateCalendarEvents.js
import fs from 'fs/promises';
import path from 'path';
import { format, startOfDay } from 'date-fns';

const PUBLIC_DIR = path.resolve(process.cwd(), 'public');
const DATA_DIR = path.join(PUBLIC_DIR, 'data');
const NAV_FILE_PATH = path.join(PUBLIC_DIR, 'nav.json');
const OUTPUT_FILE = path.join(PUBLIC_DIR, 'calendar-events.json');

async function generateCalendarEvents() {
    console.log('--- Regenerating calendar-events.json from backtestData ---');
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
                // [핵심 수정] 데이터 소스를 backtestData로 변경
                const backtestData = data.backtestData || [];
                if (backtestData.length === 0) continue;

                const tickerSymbol = path
                    .basename(fileName, '.json')
                    .toUpperCase()
                    .replace(/-/g, '.');
                const tickerInfo = tickerInfoMap.get(tickerSymbol);
                if (!tickerInfo) continue;

                const createEventEntry = (overrides) => ({
                    ticker: tickerInfo.symbol,
                    koName: tickerInfo.koName,
                    company: tickerInfo.company,
                    frequency: tickerInfo.frequency,
                    group: tickerInfo.group,
                    ...overrides,
                });

                // backtestData 배열을 순회하며 배당 및 예상일 추출
                backtestData.forEach((entry) => {
                    if (!entry.date) return;

                    const eventDate = startOfDay(new Date(entry.date));
                    const dateStr = format(eventDate, 'yyyy-MM-dd');
                    const currency = tickerInfo.currency || 'USD';

                    // amountFixed 또는 amount가 있으면 확정 배당으로 처리
                    const amount =
                        entry.amountFixed !== undefined
                            ? entry.amountFixed
                            : entry.amount;
                    if (amount !== undefined) {
                        if (!eventsByDate[dateStr]) eventsByDate[dateStr] = {};
                        if (!eventsByDate[dateStr][currency])
                            eventsByDate[dateStr][currency] = [];
                        eventsByDate[dateStr][currency].push(
                            createEventEntry({ amount })
                        );
                    }
                    // expected: true가 있으면 예상 배당일로 처리
                    else if (entry.expected === true) {
                        if (!eventsByDate[dateStr]) eventsByDate[dateStr] = {};
                        if (!eventsByDate[dateStr][currency])
                            eventsByDate[dateStr][currency] = [];

                        // 동일한 날짜에 동일한 티커의 예상일이 중복 추가되는 것 방지
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
            `🎉 Successfully generated calendar-events.json with ${Object.keys(sortedEventsByDate).length} dates.`
        );
    } catch (error) {
        console.error('❌ Error generating calendar-events.json:', error);
        process.exit(1);
    }
}

generateCalendarEvents();
