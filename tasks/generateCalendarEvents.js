// CREATE NEW FILE: tasks/generateCalendarEvents.js
import fs from 'fs/promises';
import path from 'path';
import {
    addMonths,
    addWeeks,
    addYears,
    getDay,
    isWeekend,
    nextDay,
    subMonths,
} from 'date-fns';

const PUBLIC_DIR = path.resolve(process.cwd(), 'public');
const DATA_DIR = path.join(PUBLIC_DIR, 'data');
const NAV_FILE_PATH = path.join(PUBLIC_DIR, 'nav.json');
const OUTPUT_FILE = path.join(PUBLIC_DIR, 'calendar-events.json');

const DAY_MAP = { 월: 1, 화: 2, 수: 3, 목: 4, 금: 5 };

async function generateCalendarEvents() {
    console.log(
        '--- Starting to generate calendar-events.json with future predictions ---'
    );

    try {
        const navFileContent = await fs.readFile(NAV_FILE_PATH, 'utf-8');
        const navData = JSON.parse(navFileContent);
        const tickerInfoMap = new Map(
            navData.nav.map((item) => [
                item.symbol,
                { frequency: item.frequency, group: item.group },
            ])
        );

        const today = new Date();
        const startDate = subMonths(today, 12);
        startDate.setDate(1); // 과거 12개월 전 달의 1일
        const endDate = addMonths(today, 4);
        endDate.setDate(1); // 미래 4개월 후 달의 1일

        const allFiles = await fs.readdir(DATA_DIR);
        const jsonFiles = allFiles.filter((file) => file.endsWith('.json'));

        const allEvents = new Map();

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
                const tickerInfo = tickerInfoMap.get(tickerSymbol) || {};

                let lastKnownExDate = null;

                // 1. 실제 기록 및 공시된 예상일 처리
                backtestData.forEach((entry) => {
                    const eventDate = new Date(entry.date);
                    if (eventDate >= startDate && eventDate < endDate) {
                        const eventKey = `${entry.date}-${tickerSymbol}`;
                        if (allEvents.has(eventKey)) return;

                        const isExpected = entry.expected === true;
                        const amount = isExpected
                            ? null
                            : entry.amountFixed !== undefined
                              ? entry.amountFixed
                              : entry.amount;

                        allEvents.set(eventKey, {
                            date: entry.date,
                            amount: amount,
                            isExpected: isExpected,
                            ticker: tickerSymbol,
                            ...tickerInfo,
                        });
                    }
                    // 가장 최신 배당락일 기록 (예측 시작점으로 사용)
                    if (
                        !entry.expected &&
                        (entry.amount !== undefined ||
                            entry.amountFixed !== undefined)
                    ) {
                        lastKnownExDate = eventDate;
                    }
                });

                // 2. 미래 배당일 예측 (가장 최근 실제 배당일 기준)
                if (lastKnownExDate && tickerInfo.frequency) {
                    let nextDate = new Date(lastKnownExDate);

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
                            const targetDay = DAY_MAP[tickerInfo.group];
                            // 다음 주로 이동 후 해당 요일 찾기
                            nextDate = nextDay(
                                addWeeks(nextDate, 1),
                                targetDay
                            );
                        } else break;

                        if (nextDate >= endDate) break;

                        // 주말일 경우 금요일로 조정 (간단한 비즈니스데이 로직)
                        const dayOfWeek = getDay(nextDate);
                        if (dayOfWeek === 0)
                            nextDate.setDate(nextDate.getDate() - 2); // 일요일 -> 금요일
                        if (dayOfWeek === 6)
                            nextDate.setDate(nextDate.getDate() - 1); // 토요일 -> 금요일

                        const dateStr = nextDate.toISOString().split('T')[0];
                        const eventKey = `${dateStr}-${tickerSymbol}`;

                        if (!allEvents.has(eventKey)) {
                            allEvents.set(eventKey, {
                                date: dateStr,
                                amount: null,
                                isExpected: true,
                                ticker: tickerSymbol,
                                ...tickerInfo,
                            });
                        }
                    }
                }
            } catch (e) {
                continue;
            }
        }

        const finalEvents = Array.from(allEvents.values());
        await fs.writeFile(OUTPUT_FILE, JSON.stringify(finalEvents, null, 2));
        console.log(
            `🎉 Successfully generated calendar-events.json with ${finalEvents.length} events.`
        );
    } catch (error) {
        console.error('❌ Error generating calendar-events.json:', error);
        process.exit(1);
    }
}

generateCalendarEvents();
