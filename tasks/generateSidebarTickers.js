// CREATE NEW FILE: tasks/generateSidebarTickers.js
import fs from 'fs/promises';
import path from 'path';

const PUBLIC_DIR = path.resolve(process.cwd(), 'public');
const DATA_DIR = path.join(PUBLIC_DIR, 'data');
const NAV_FILE_PATH = path.join(PUBLIC_DIR, 'nav.json');
const OUTPUT_FILE = path.join(PUBLIC_DIR, 'sidebar-tickers.json');

// 파일명에서 티커를 추출하기 위한 헬퍼 함수
const getTickerFromFilename = (filename) => {
    return path.basename(filename, '.json').toUpperCase();
};

async function generateSidebarTickers() {
    console.log('--- Starting to generate sidebar-tickers.json ---');

    try {
        // 1. data 폴더의 모든 파일에서 'Yield' 값만 빠르게 추출하여 Map을 생성합니다.
        const yieldMap = new Map();
        const allDataFiles = await fs.readdir(DATA_DIR);
        for (const file of allDataFiles) {
            if (file.endsWith('.json')) {
                const filePath = path.join(DATA_DIR, file);
                try {
                    const content = await fs.readFile(filePath, 'utf-8');
                    const data = JSON.parse(content);
                    const tickerSymbol = getTickerFromFilename(file);
                    if (data.tickerInfo && data.tickerInfo.Yield) {
                        yieldMap.set(tickerSymbol, data.tickerInfo.Yield);
                    }
                } catch (e) {
                    // JSON 파싱 오류 등 개별 파일 오류는 무시하고 계속 진행
                }
            }
        }
        console.log(`Extracted yield data for ${yieldMap.size} tickers.`);

        // 2. nav.json 파일을 읽어 기본 티커 정보를 가져옵니다.
        const navContent = await fs.readFile(NAV_FILE_PATH, 'utf-8');
        const navData = JSON.parse(navContent);

        // 요일 그룹 정렬 순서
        const dayOrder = { 월: 1, 화: 2, 수: 3, 목: 4, 금: 5 };

        // 3. nav.json 데이터에 Yield 값을 병합하여 최종 데이터를 생성합니다.
        const sidebarTickers = navData.nav
            .filter((item) => !item.upcoming) // upcoming이 아닌 활성 티커만 포함
            .map((item) => {
                const tickerSymbol = item.symbol.toUpperCase();
                return {
                    symbol: item.symbol,
                    longName: item.longName,
                    company: item.company,
                    logo: item.logo,
                    frequency: item.frequency,
                    group: item.group,
                    yield: yieldMap.get(tickerSymbol) || '-', // Yield 값이 없으면 '-'
                    groupOrder: dayOrder[item.group] ?? 999, // 정렬을 위한 값
                };
            });

        // 4. 최종 데이터를 파일로 저장합니다.
        await fs.writeFile(
            OUTPUT_FILE,
            JSON.stringify(sidebarTickers, null, 2)
        );

        console.log(
            `🎉 Successfully generated sidebar-tickers.json with ${sidebarTickers.length} active tickers.`
        );
    } catch (error) {
        console.error('❌ Error generating sidebar-tickers.json:', error);
        process.exit(1);
    }
}

generateSidebarTickers();
