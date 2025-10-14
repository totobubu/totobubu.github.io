// tasks/generateNav.js;
import fs from 'fs';
import path from 'path';

const rootDir = process.cwd();
const publicDir = path.join(rootDir, 'public');
const navDir = path.join(publicDir, 'nav');
const dataDir = path.join(publicDir, 'data');
const logosDir = path.join(publicDir, 'logos');
const outputFile = path.join(publicDir, 'nav.json');

function normalizeToFilename(name) {
    if (!name || typeof name !== 'string') return null;
    return name.toLowerCase().replace(/[.,']/g, '').replace(/\s+/g, '-');
}

function findLogoFile(normalizedName) {
    if (!normalizedName) return null;
    const supportedExtensions = ['.svg', '.png', '.webp', '.jpg', '.jpeg'];
    for (const ext of supportedExtensions) {
        const filePath = path.join(logosDir, `${normalizedName}${ext}`);
        if (fs.existsSync(filePath)) {
            return `logos/${normalizedName}${ext}`;
        }
    }
    return null;
}

function parseYYMMDD(dateString) {
    if (!dateString || typeof dateString !== 'string') return null;
    const parts = dateString.split('.').map((s) => parseInt(s.trim(), 10));
    if (parts.length !== 3) return null;
    let [year, month, day] = parts;
    year += year < 70 ? 2000 : 1900;
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

// 파일을 읽고 Ticker 목록에 추가하는 헬퍼 함수
function processAndPushTickers(filePath, market, allTickers) {
    try {
        const data = fs.readFileSync(filePath, 'utf8');
        const tickers = JSON.parse(data);

        tickers.forEach((ticker) => {
            // market 정보가 없는 경우에만 할당 (소스 파일에 이미 market 정보가 있을 수 있음)
            if (!ticker.market) {
                ticker.market = market;
            }
            // currency 정보 할당
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
    const navEntries = fs.readdirSync(navDir, { withFileTypes: true });

    for (const entry of navEntries) {
        // [수정] 항목이 디렉토리인 경우 (KOSPI, KOSDAQ 등)
        if (entry.isDirectory()) {
            const market = entry.name;
            const marketPath = path.join(navDir, market);
            const files = fs
                .readdirSync(marketPath)
                .filter((f) => f.endsWith('.json'));

            for (const file of files) {
                const filePath = path.join(marketPath, file);
                processAndPushTickers(filePath, market, allTickers);
            }
        }
        // [수정] 항목이 파일인 경우 (기존 미국 주식 a.json, b.json 등)
        else if (
            entry.isFile() &&
            entry.name.endsWith('.json') &&
            !entry.name.includes('rules')
        ) {
            const filePath = path.join(navDir, entry.name);
            // 미국 주식의 기본 market을 'NASDAQ' 등으로 가정
            processAndPushTickers(filePath, 'NASDAQ', allTickers);
        }
    }

    const finalTickersPromises = allTickers.map(async (ticker) => {
        let processedTicker = { ...ticker };

        let nameForLogoSearch = ticker.company || ticker.symbol;
        const normalizedName = normalizeToFilename(nameForLogoSearch);
        const logoPath = findLogoFile(normalizedName);

        if (logoPath) {
            processedTicker.logo = logoPath;
        } else if (nameForLogoSearch) {
            // console.log(`🔸 ${ticker.symbol}: 로고 없음. 검색 시도한 이름: "${normalizedName}"`);
        }

        if (!processedTicker.periods) {
            const dataFilePath = path.join(
                dataDir,
                `${processedTicker.symbol.toLowerCase().replace(/\./g, '-')}.json`
            );
            try {
                const dataFileContent = await fs.promises.readFile(
                    dataFilePath,
                    'utf8'
                );
                const stockData = JSON.parse(dataFileContent);
                const history = stockData.dividendHistory;

                if (history && history.length > 0) {
                    const oldestRecord = history[history.length - 1];
                    const firstDividend_date = parseYYMMDD(
                        oldestRecord['배당락']
                    );

                    if (firstDividend_date) {
                        const today = new Date();
                        const yearsOfHistory =
                            (today - firstDividend_date) /
                            (1000 * 60 * 60 * 24 * 365.25);
                        let calculatedPeriods = [];

                        const masterPeriods = [
                            '6M',
                            '1Y',
                            '3Y',
                            '5Y',
                            '10Y',
                            '15Y',
                            '20Y',
                        ];
                        calculatedPeriods = masterPeriods.filter(
                            (p) => yearsOfHistory >= convertPeriodToYears(p)
                        );

                        // 분기 배당주는 최소 3년 기록이 없으면 periods를 비움
                        if (
                            processedTicker.frequency === '분기' &&
                            yearsOfHistory < 3
                        ) {
                            calculatedPeriods = [];
                        }

                        processedTicker.periods = calculatedPeriods;
                    }
                } else {
                    processedTicker.periods = [];
                }
            } catch (error) {
                // 데이터 파일이 없는 경우, periods는 비어있게 됨
                processedTicker.periods = [];
            }
        }
        return processedTicker;
    });

    let finalTickers = await Promise.all(finalTickersPromises);
    finalTickers.sort((a, b) => a.symbol.localeCompare(b.symbol));

    const navJson = JSON.stringify({ nav: finalTickers }, null, 4);
    await fs.promises.writeFile(outputFile, navJson, 'utf8');

    console.log(
        `\n🎉 nav.json 파일 생성 완료! (총 ${finalTickers.length}개 티커 포함)`
    );
}

generateNavJson();
