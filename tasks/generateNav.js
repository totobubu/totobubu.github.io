// tasks/generateNav.js
import fs from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';

const rootDir = process.cwd();
const publicDir = path.join(rootDir, 'public');
const navDir = path.join(publicDir, 'nav');
const dataDir = path.join(publicDir, 'data');
const logosDir = path.join(publicDir, 'logos');
const outputFile = path.join(publicDir, 'nav.json');

// --- [핵심 수정 1] 한국 ETF 운용사 이름과 로고 파일명 매핑 객체 추가 ---
const koreanEtfBrandMap = {
    미래에셋자산운용: 'korea-tiger',
    삼성자산운용: 'korea-kodex',
    kb자산운용: 'korea-kbstar',
    한국투자신탁운용: 'korea-ace',
    엔에이치아문디자산운용: 'korea-HANARO',
    신한자산운용: 'korea-SOL',
    타임폴리오자산운용: 'korea-time',
    비엔케이자산운용: 'korea-bnk',
    // 필요한 다른 운용사들을 여기에 추가할 수 있습니다.
};
// --- // ---

function normalizeToFilename(name) {
    if (!name) return null;
    return name.toLowerCase().replace(/[.,']/g, '').replace(/\s+/g, '-');
}

function findLogoFile(normalizedName) {
    if (!normalizedName) return null;
    const supportedExtensions = [
        '.svg',
        '.png',
        '.webp',
        '.jpg',
        '.jpeg',
        'ico',
    ];
    for (const ext of supportedExtensions) {
        const filePath = path.join(logosDir, `${normalizedName}${ext}`);
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

        // --- [핵심 수정 2] 로고 검색 이름 결정 로직 수정 ---
        let nameForLogoSearch;
        if (ticker.company && koreanEtfBrandMap[ticker.company]) {
            // 매핑 객체에 한국 운용사 이름이 있으면, 매핑된 영어 이름을 사용
            nameForLogoSearch = koreanEtfBrandMap[ticker.company];
        } else {
            // 그 외의 경우(미국 ETF, 로고 없는 종목 등) 기존 로직 사용
            nameForLogoSearch = ticker.company || ticker.symbol;
        }
        // --- // ---

        const normalizedName = normalizeToFilename(nameForLogoSearch);
        const logoPath = findLogoFile(normalizedName);

        if (logoPath) {
            processedTicker.logo = logoPath;
        } else if (nameForLogoSearch) {
            console.log(
                `🔸 ${ticker.symbol}: 로고 없음. 검색 시도한 이름: "${normalizedName}"`
            );
            processedTicker.logo = null;
        }

        const dataFilePath = path.join(
            dataDir,
            `${ticker.symbol.replace(/\./g, '-').toLowerCase()}.json`
        );
        try {
            // ... (파일 읽고 파싱하는 로직은 변경 없음)
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
                    '6M', '1Y', '3Y', '5Y', '10Y', '15Y', '20Y',
                ];

                // --- [핵심 수정] ---
                if (processedTicker.frequency === '매주') {
                    masterPeriods = ['6M', '1Y']; // '매주' 배당은 '월' 단위 옵션만 사용
                } else if (processedTicker.frequency === '매월') {
                    masterPeriods = ['1Y', '2Y', '3Y', '5Y', '10Y'];
                } else if (processedTicker.frequency === '분기') {
                    masterPeriods = ['5Y', '10Y', '15Y', '20Y'];
                } else if (processedTicker.frequency === '매년') {
                    masterPeriods = ['10Y', '15Y', '20Y'];
                }
                // --- // ---

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