import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const navDir = path.join(__dirname, 'public', 'nav');
const dataDir = path.join(__dirname, 'public', 'data');
const outputFile = path.join(__dirname, 'public', 'nav.json');

// --- 헬퍼 함수들 ---

function parseYYMMDD(dateString) {
    if (!dateString || typeof dateString !== 'string') return null;
    const parts = dateString.split('.').map(s => parseInt(s.trim(), 10));
    if (parts.length !== 3) return null;
    let [year, month, day] = parts;
    year += (year < 70) ? 2000 : 1900; 
    return new Date(year, month - 1, day);
}

function convertPeriodToYears(periodString) {
    const value = parseInt(periodString);
    const unit = periodString.slice(-1).toUpperCase();
    if (unit === 'Y') return value;
    if (unit === 'M') return value / 12;
    return 0;
}

// --- 메인 함수 ---

async function generateNavJson() {
    let allTickers = [];
    
    const files = fs.readdirSync(navDir).filter(f => f.endsWith('.json') && !f.includes('rules'));
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
        if (ticker.periods) {
            console.log(`🔹 ${ticker.symbol}: 수동으로 지정된 periods 사용.`);
            return ticker;
        }

        const dataFilePath = path.join(dataDir, `${ticker.symbol.toLowerCase()}.json`);
        
        try {
            const dataFileContent = await fs.promises.readFile(dataFilePath, 'utf8');
            const stockData = JSON.parse(dataFileContent);
            const history = stockData.dividendHistory;

            if (!history || history.length === 0) {
                console.log(`🔸 ${ticker.symbol}: 배당 기록 없음.`);
                return { ...ticker, periods: [] };
            }

            const oldestRecord = history[history.length - 1];
            const firstDividend_date = parseYYMMDD(oldestRecord['배당락']);

            if (!firstDividend_date) {
                console.warn(`⚠️ ${ticker.symbol}: 가장 오래된 배당일자 파싱 실패.`);
                return ticker;
            }
            
            const today = new Date();
            const yearsOfHistory = (today - firstDividend_date) / (1000 * 60 * 60 * 24 * 365.25);
            
            let calculatedPeriods = [];
            let ruleType = '';

            // [핵심 로직] 규칙에 따라 분기 처리
            if (ticker.frequency === '분기') {
                ruleType = '[분기 규칙]';
                // 규칙 1: 분기 배당주는 역사가 3년 이상이어야 함
                if (yearsOfHistory >= 3) {
                    const masterPeriods = ["3Y", "5Y", "10Y", "15Y", "20Y"];
                    calculatedPeriods = masterPeriods.filter(p => yearsOfHistory >= convertPeriodToYears(p));
                }
            } else {
                ruleType = '[기본 규칙]';
                // 규칙 2: 그 외는 역사가 6개월(0.5년) 이상이어야 함
                if (yearsOfHistory >= 0.5) {
                    const masterPeriods = ["6M", "1Y", "3Y", "5Y", "10Y", "15Y", "20Y"];
                    calculatedPeriods = masterPeriods.filter(p => yearsOfHistory >= convertPeriodToYears(p));
                }
            }
            
            const periodsString = calculatedPeriods.length > 0 ? `[${calculatedPeriods.join(', ')}]` : '[전체]';
            console.log(`✅ ${ticker.symbol}: ${yearsOfHistory.toFixed(1)}년 기록 ${ruleType} -> periods: ${periodsString} 생성`);
            return { ...ticker, periods: calculatedPeriods };

        } catch (error) {
            console.log(`🔸 ${ticker.symbol}: 데이터 파일 없음. periods를 생성하지 않습니다.`);
            return ticker;
        }
    });

    let finalTickers = await Promise.all(finalTickersPromises);
    finalTickers.sort((a, b) => a.symbol.localeCompare(b.symbol));

    const navJson = JSON.stringify({ nav: finalTickers }, null, 4);
    await fs.promises.writeFile(outputFile, navJson, 'utf8');

    console.log('\n🎉 nav.json 파일 생성 완료! (세부 규칙이 적용되었습니다)');
}

generateNavJson();