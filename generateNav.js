import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const publicDir = path.join(__dirname, 'public');
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
            // [핵심 수정] 맨 앞의 슬래시 제거
            return `logos/${normalizedName}${ext}`;
        }
    }
    return null; // 로고 없음
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
    const value = parseInt(periodString);
    const unit = periodString.slice(-1).toUpperCase();
    if (unit === 'Y') return value;
    if (unit === 'M') return value / 12;
    return 0;
}
// --- // ---

async function generateNavJson() {
    let allTickers = [];
    const files = fs
        .readdirSync(navDir)
        .filter((f) => f.endsWith('.json') && !f.includes('rules'));
    for (const file of files) {
        const filePath = path.join(navDir, file);
        try {
            const data = fs.readFileSync(filePath, 'utf8');
            allTickers.push(...JSON.parse(data));
        } catch (error) {
            console.error(`[${file}] 파일 읽기 오류: ${error}`);
        }
    }

    const finalTickersPromises = allTickers.map(async (ticker) => {
        let processedTicker = { ...ticker };

        let nameForLogoSearch;
        let logoType = '';
        if (ticker.company) {
            nameForLogoSearch = ticker.company;
            logoType = '운용사';
        } else {
            nameForLogoSearch = ticker.symbol;
            logoType = '개별 주식';
        }

        const normalizedName = normalizeToFilename(nameForLogoSearch);
        const logoPath = findLogoFile(normalizedName);

        if (logoPath) {
            processedTicker.logo = logoPath;
        }
        // [핵심 디버깅 코드 추가] 로고를 못 찾았을 때 로그 출력
        else if (nameForLogoSearch) {
            console.log(
                `🔸 ${ticker.symbol}: 로고 없음. 검색 시도한 이름: "${normalizedName}"`
            );
        }

        if (!processedTicker.periods) {
            const dataFilePath = path.join(
                dataDir,
                `${processedTicker.symbol.toLowerCase()}.json`
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

                        if (processedTicker.frequency === '분기') {
                            if (yearsOfHistory >= 3) {
                                const masterPeriods = [
                                    '3Y',
                                    '5Y',
                                    '10Y',
                                    '15Y',
                                    '20Y',
                                ];
                                calculatedPeriods = masterPeriods.filter(
                                    (p) =>
                                        yearsOfHistory >=
                                        convertPeriodToYears(p)
                                );
                            }
                        } else {
                            if (yearsOfHistory >= 0.5) {
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
                                    (p) =>
                                        yearsOfHistory >=
                                        convertPeriodToYears(p)
                                );
                            }
                        }
                        // [수정] return 대신 processedTicker에 직접 할당
                        processedTicker.periods = calculatedPeriods;
                    }
                } else {
                    // 배당 기록이 없는 경우
                    processedTicker.periods = [];
                }
            } catch (error) {
                // 데이터 파일이 없는 경우, 아무것도 하지 않음 (periods는 undefined로 남음)
            }
        }

        return processedTicker;
    });

    let finalTickers = await Promise.all(finalTickersPromises);
    finalTickers.sort((a, b) => a.symbol.localeCompare(b.symbol));

    const navJson = JSON.stringify({ nav: finalTickers }, null, 4);
    await fs.promises.writeFile(outputFile, navJson, 'utf8');

    console.log(
        '\n🎉 nav.json 파일 생성 완료! (ETF/개별주식 로고 및 periods 동적 생성됨)'
    );
}

generateNavJson();
