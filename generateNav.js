// REFACTORED: generateNav.js

import fs from 'fs/promises';
import path from 'path';

const publicDir = path.resolve(process.cwd(), 'public');
const navDir = path.join(publicDir, 'nav');
const dataDir = path.join(publicDir, 'data');
const logosDir = path.join(publicDir, 'logos');
const outputFile = path.join(publicDir, 'nav.json');

// --- [핵심 추가] ---
// 디렉토리 이름(시장)에 따른 통화 매핑 규칙
const currencyMap = {
    KOSPI: 'KRW',
    KOSDAQ: 'KRW',
    NASDAQ: 'USD',
    NYSE: 'USD',
    COIN: 'USD',
    // 새로운 시장을 추가할 때 여기에 규칙을 추가하면 됩니다.
};

function getCurrencyFromMarket(marketName) {
    return currencyMap[marketName] || 'USD'; // 규칙에 없으면 기본값 'USD'
}
// --- // ---

function normalizeToFilename(name) {
    if (!name || typeof name !== 'string') return null;
    return name.toLowerCase().replace(/[.,']/g, '').replace(/\s+/g, '-');
}

async function findLogoFile(normalizedName) {
    if (!normalizedName) return null;
    const supportedExtensions = ['.svg', '.png', '.webp', '.jpg', '.jpeg'];
    for (const ext of supportedExtensions) {
        const filePath = path.join(logosDir, `${normalizedName}${ext}`);
        try {
            await fs.access(filePath);
            return `logos/${normalizedName}${ext}`;
        } catch {
            // 파일이 존재하지 않음
        }
    }
    return null;
}

function parseYYMMDD(dateString) {
    if (!dateString || typeof dateString !== 'string') return null;
    const parts = dateString.split('.').map((s) => parseInt(s.trim(), 10));
    if (parts.length !== 3) return null;
    let [year, month, day] = parts;
    const currentYearLastTwoDigits = new Date().getFullYear() % 100;
    year += year > currentYearLastTwoDigits + 1 ? 1900 : 2000;
    return new Date(year, month - 1, day);
}

function convertPeriodToYears(periodString) {
    if (!periodString) return 0;
    const value = parseInt(periodString);
    const unit = periodString.slice(-1).toUpperCase();
    if (unit === 'Y') return value;
    if (unit === 'M') return value / 12;
    return 0;
}

async function getPeriodsFromHistory(tickerSymbol) {
    const sanitizedSymbol = tickerSymbol.replace(/\./g, '-').toLowerCase();
    const dataFilePath = path.join(dataDir, `${sanitizedSymbol}.json`);
    try {
        const dataFileContent = await fs.readFile(dataFilePath, 'utf8');
        const stockData = JSON.parse(dataFileContent);
        const history = stockData.dividendHistory;

        if (history && history.length > 0) {
            const oldestRecord = history[history.length - 1];
            const firstDividend_date = parseYYMMDD(oldestRecord['배당락']);

            if (firstDividend_date) {
                const yearsOfHistory =
                    (new Date() - firstDividend_date) /
                    (1000 * 60 * 60 * 24 * 365.25);
                const masterPeriods = [
                    '6M',
                    '1Y',
                    '3Y',
                    '5Y',
                    '10Y',
                    '15Y',
                    '20Y',
                ];
                return masterPeriods.filter(
                    (p) => yearsOfHistory >= convertPeriodToYears(p)
                );
            }
        }
    } catch (error) {
        // 데이터 파일이 없어도 괜찮음
    }
    return [];
}

async function generateNavJson() {
    let allTickers = [];
    const marketDirs = await fs.readdir(navDir, { withFileTypes: true });

    for (const marketDir of marketDirs) {
        if (marketDir.isDirectory()) {
            const marketName = marketDir.name;
            const marketPath = path.join(navDir, marketName);
            const files = await fs.readdir(marketPath);

            for (const file of files) {
                if (file.endsWith('.json')) {
                    const filePath = path.join(marketPath, file);
                    try {
                        const data = await fs.readFile(filePath, 'utf8');
                        const tickersInFile = JSON.parse(data);

                        tickersInFile.forEach((ticker) => {
                            // --- [핵심 수정] ---
                            // 1. 디렉토리 이름으로 market 속성 자동 부여
                            const market = marketName;
                            // 2. market 이름으로 currency 속성 자동 부여
                            const currency = getCurrencyFromMarket(marketName);

                            allTickers.push({ ...ticker, market, currency });
                            // --- // ---
                        });
                    } catch (error) {
                        console.error(`[${filePath}] 파일 읽기 오류: ${error}`);
                    }
                }
            }
        }
    }

    const finalTickersPromises = allTickers.map(async (ticker) => {
        let processedTicker = { ...ticker };

        const nameForLogoSearch = ticker.company || ticker.symbol;
        const normalizedName = normalizeToFilename(nameForLogoSearch);
        processedTicker.logo = await findLogoFile(normalizedName);

        if (!processedTicker.logo && nameForLogoSearch) {
            console.log(
                `🔸 ${ticker.symbol}: 로고 없음. 검색 시도한 이름: "${normalizedName}"`
            );
        }

        if (!processedTicker.periods) {
            processedTicker.periods = await getPeriodsFromHistory(
                processedTicker.symbol
            );
        }

        return processedTicker;
    });

    let finalTickers = await Promise.all(finalTickersPromises);
    finalTickers.sort((a, b) => a.symbol.localeCompare(b.symbol));

    const navJson = JSON.stringify({ nav: finalTickers }, null, 4);
    await fs.writeFile(outputFile, navJson, 'utf8');

    console.log(
        '\n🎉 nav.json 파일 생성 완료! (시장/통화 정보 자동 부여 및 periods 동적 생성됨)'
    );
}

generateNavJson();
