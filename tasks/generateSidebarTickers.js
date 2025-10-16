// tasks\generateSidebarTickers.js
import fs from 'fs/promises';
import path from 'path';

const PUBLIC_DIR = path.resolve(process.cwd(), 'public');
const DATA_DIR = path.join(PUBLIC_DIR, 'data');
const NAV_FILE_PATH = path.join(PUBLIC_DIR, 'nav.json');
const OUTPUT_FILE = path.join(PUBLIC_DIR, 'sidebar-tickers.json');

const getTickerFromFilename = (filename) => {
    return path.basename(filename, '.json').toUpperCase().replace(/-/g, '.');
};

async function generateSidebarTickers() {
    console.log('--- Starting to generate sidebar-tickers.json ---');
    try {
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
                } catch (e) {}
            }
        }

        const navContent = await fs.readFile(NAV_FILE_PATH, 'utf-8');
        const navData = JSON.parse(navContent);
        const dayOrder = { 월: 1, 화: 2, 수: 3, 목: 4, 금: 5 };

        const sidebarTickers = navData.nav
            .filter((item) => !item.upcoming)
            .map((item) => {
                const tickerSymbol = item.symbol;
                return {
                    symbol: item.symbol,
                    koName: item.koName, // koName 필드 포함
                    longName: item.longName,
                    company: item.company,
                    logo: item.logo,
                    frequency: item.frequency,
                    group: item.group,
                    yield: yieldMap.get(tickerSymbol) || 'N/A',
                    groupOrder: dayOrder[item.group] ?? 999,
                    currency: item.currency,
                    underlying: item.underlying,
                    market: item.market,
                };
            });

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
