// tasks/generateNav.js;
import fs from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';

const rootDir = process.cwd();
const publicDir = path.join(rootDir, 'public');
const navDir = path.join(publicDir, 'nav');
const dataDir = path.join(publicDir, 'data');
const logosDir = path.join(publicDir, 'logos');
const outputFile = path.join(publicDir, 'nav.json');

function normalizeToFilename(name) {
    if (!name) return null;
    return name.toLowerCase().replace(/[.,']/g, '').replace(/\s+/g, '-');
}

function findLogoFile(normalizedName) {
    if (!normalizedName) return null;
    const supportedExtensions = ['.svg', '.png', '.webp', '.jpg', '.jpeg'];
    for (const ext of supportedExtensions) {
        const filePath = path.join(logosDir, `${normalizedName}${ext}`);
        // [핵심 수정] import한 existsSync를 직접 사용
        if (existsSync(filePath)) {
            return `logos/${normalizedName}${ext}`;
        }
    }
    return null;
}

function convertPeriodToYears(periodString) {
    if (!periodString) return 0;
    const value = parseInt(periodString);
    const unit = periodString.slice(-1).toUpperCase();
    if (unit === 'Y') return value;
    if (unit === 'M') return value / 12;
    return 0;
}

async function processAndPushTickers(filePath, market, allTickers) {
    try {
        const data = await fs.readFile(filePath, 'utf8');
        const tickers = JSON.parse(data);
        tickers.forEach((ticker) => {
            if (!ticker.market) ticker.market = market;
            ticker.currency =
                ticker.market === 'KOSPI' || ticker.market === 'KOSDAQ'
                    ? 'KRW'
                    : 'USD';
        });
        allTickers.push(...tickers);
    } catch (error) {
        console.error(`[${filePath}] 파일 읽기 오류: ${error}`);
    }
}

async function generateNavJson() {
    let allTickers = [];
    const navEntries = await fs.readdir(navDir, { withFileTypes: true });

    for (const entry of navEntries) {
        if (entry.isDirectory()) {
            const marketPath = path.join(navDir, entry.name);
            const files = (await fs.readdir(marketPath)).filter((f) =>
                f.endsWith('.json')
            );
            for (const file of files) {
                await processAndPushTickers(
                    path.join(marketPath, file),
                    entry.name,
                    allTickers
                );
            }
        } else if (
            entry.isFile() &&
            entry.name.endsWith('.json') &&
            !entry.name.includes('rules')
        ) {
            await processAndPushTickers(
                path.join(navDir, entry.name),
                'NASDAQ',
                allTickers
            );
        }
    }

    const finalTickersPromises = allTickers.map(async (ticker) => {
        let processedTicker = { ...ticker };

        const nameForLogoSearch = ticker.company || ticker.symbol;
        const normalizedName = normalizeToFilename(nameForLogoSearch);
        const logoPath = findLogoFile(normalizedName); // findLogoFile 함수는 수정 없이 그대로 사용

        // [핵심 수정] logoPath가 없을 경우 로그를 출력하는 로직 복원
        if (logoPath) {
            processedTicker.logo = logoPath;
        } else if (nameForLogoSearch) {
            // 로고가 없는 경우, 어떤 이름으로 검색했는지 로그를 남김
            console.log(
                `🔸 ${ticker.symbol}: 로고 없음. 검색 시도한 이름: "${normalizedName}"`
            );
            processedTicker.logo = null; // 명시적으로 null 처리
        }

        const dataFilePath = path.join(
            dataDir,
            `${ticker.symbol.replace(/\./g, '-').toLowerCase()}.json`
        );
        try {
            const dataFileContent = await fs.readFile(dataFilePath, 'utf8');
            const stockData = JSON.parse(dataFileContent);
            const backtestData = stockData.backtestData || [];

            const firstDividendEntry = backtestData.find(
                (d) => d.amount !== null && typeof d.amount !== 'undefined'
            );
            const startDateStr = firstDividendEntry
                ? firstDividendEntry.date
                : ticker.ipoDate;

            if (startDateStr) {
                const startDate = new Date(startDateStr);
                const today = new Date();
                const yearsOfHistory =
                    (today - startDate) / (1000 * 60 * 60 * 24 * 365.25);

                let masterPeriods = [
                    '6M',
                    '1Y',
                    '3Y',
                    '5Y',
                    '10Y',
                    '15Y',
                    '20Y',
                ];

                // [핵심 수정] "매년" 배당일 경우 masterPeriods를 장기 옵션으로 제한
                if (processedTicker.frequency === '매년') {
                    masterPeriods = ['10Y', '15Y', '20Y'];
                }

                const calculatedPeriods = masterPeriods.filter(
                    (p) => yearsOfHistory >= convertPeriodToYears(p)
                );
                processedTicker.periods = calculatedPeriods;
            } else {
                processedTicker.periods = [];
            }
        } catch (error) {
            processedTicker.periods = [];
        }

        return processedTicker;
    });

    let finalTickers = await Promise.all(finalTickersPromises);
    finalTickers.sort((a, b) => a.symbol.localeCompare(b.symbol));

    const navJson = JSON.stringify({ nav: finalTickers }, null, 2);
    await fs.writeFile(outputFile, navJson);

    console.log(
        `\n🎉 nav.json 파일 생성 완료! (총 ${finalTickers.length}개 티커, periods 재생성 완료)`
    );
}

generateNavJson();
