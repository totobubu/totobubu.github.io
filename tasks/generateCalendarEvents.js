// CREATE NEW FILE: tasks/generateCalendarEvents.js
import fs from 'fs/promises';
import path from 'path';

const PUBLIC_DIR = path.resolve(process.cwd(), 'public');
const DATA_DIR = path.join(PUBLIC_DIR, 'data');
const NAV_FILE_PATH = path.join(PUBLIC_DIR, 'nav.json');
const OUTPUT_FILE = path.join(PUBLIC_DIR, 'calendar-events.json');

async function generateCalendarEvents() {
    console.log('--- Starting to generate calendar-events.json ---');

    try {
        // 1. nav.json에서 티커 정보(frequency, group)를 Map으로 만듭니다.
        const navFileContent = await fs.readFile(NAV_FILE_PATH, 'utf-8');
        const navData = JSON.parse(navFileContent);
        const tickerInfoMap = new Map(
            navData.nav.map((item) => [
                item.symbol,
                { frequency: item.frequency, group: item.group },
            ])
        );

        // 2. data 디렉토리의 모든 json 파일을 읽습니다.
        const allFiles = await fs.readdir(DATA_DIR);
        const jsonFiles = allFiles.filter((file) => file.endsWith('.json'));

        const allEvents = [];

        for (const fileName of jsonFiles) {
            const filePath = path.join(DATA_DIR, fileName);
            const fileContent = await fs.readFile(filePath, 'utf-8');
            const data = JSON.parse(fileContent);

            // 3. 각 파일에서 dividendHistory를 추출하여 필요한 데이터만 가공합니다.
            if (data.dividendHistory && Array.isArray(data.dividendHistory)) {
                // 파일 이름에서 티커 심볼을 추출합니다 (예: 'aapl.json' -> 'AAPL').
                const tickerSymbol = path
                    .basename(fileName, '.json')
                    .toUpperCase();
                const tickerInfo = tickerInfoMap.get(tickerSymbol) || {};

                data.dividendHistory.forEach((dividend) => {
                    if (dividend && dividend.배당락) {
                        try {
                            const parts = dividend.배당락
                                .split('.')
                                .map((p) => p.trim());
                            const dateStr = `20${parts[0]}-${parts[1].padStart(2, '0')}-${parts[2].padStart(2, '0')}`;

                            const amount = dividend.배당금
                                ? parseFloat(dividend.배당금.replace('$', ''))
                                : null;

                            allEvents.push({
                                date: dateStr,
                                amount,
                                ticker: tickerSymbol,
                                frequency: tickerInfo.frequency,
                                group: tickerInfo.group,
                            });
                        } catch (e) {
                            // 날짜 형식이 잘못된 경우 무시
                        }
                    }
                });
            }
        }

        // 4. 최종적으로 하나의 JSON 파일로 저장합니다.
        await fs.writeFile(OUTPUT_FILE, JSON.stringify(allEvents, null, 2));

        console.log(
            `🎉 Successfully generated calendar-events.json with ${allEvents.length} events.`
        );
    } catch (error) {
        console.error('❌ Error generating calendar-events.json:', error);
        process.exit(1);
    }
}

generateCalendarEvents();
