// tasks/generateCalendarEvents.js

import fs from 'fs/promises';
import path from 'path';

const PUBLIC_DIR = path.resolve(process.cwd(), 'public');
const DATA_DIR = path.join(PUBLIC_DIR, 'data');
const NAV_FILE_PATH = path.join(PUBLIC_DIR, 'nav.json');
const CALENDAR_MONTHLY_DIR = path.join(PUBLIC_DIR, 'calendar', 'monthly');

const KRX_SUFFIXES = new Set(['.KS', '.KQ', '.KN', '.KO']);

const normalizeYahooSymbol = (symbol) => {
    if (!symbol || typeof symbol !== 'string') return null;
    return symbol.trim().toUpperCase();
};

const extractBaseSymbol = (symbol) => {
    const normalized = normalizeYahooSymbol(symbol);
    if (!normalized) return null;
    for (const suffix of KRX_SUFFIXES) {
        if (normalized.endsWith(suffix)) {
            return normalized.slice(0, -suffix.length);
        }
    }
    return normalized;
};

// 한국 ETF 브랜드명 목록
const koreanEtfBrands = [
    'KODEX',
    'TIGER',
    'KBSTAR',
    'ACE',
    'ARIRANG',
    'HANARO',
    'SOL',
    'PLUS',
    'RISE',
    'TIMEFOLIO',
    'KOSEF',
    'KINDEX',
    'TRUE',
    'FOCUS',
    'SMART',
    'QV',
    'TREX',
    'HK ',
];

async function generateCalendarEvents() {
    console.log('--- Generating monthly calendar events ---');

    // calendar/monthly 디렉토리 생성
    try {
        await fs.mkdir(CALENDAR_MONTHLY_DIR, { recursive: true });
    } catch (e) {
        // 이미 존재하면 무시
    }

    let navData;
    try {
        navData = JSON.parse(await fs.readFile(NAV_FILE_PATH, 'utf-8'));
    } catch (error) {
        console.error(
            '❌ Critical Error: Failed to load nav.json. Aborting.',
            error
        );
        process.exit(1);
    }

    const tickerInfoMap = new Map(
        navData.nav
            .map((item) => {
                // ETF 판단 로직
                let isEtf = !!(item.company || item.underlying);
                if (!isEtf && item.koName) {
                    isEtf = koreanEtfBrands.some((brand) =>
                        item.koName.startsWith(brand)
                    );
                }

                const baseSymbol = extractBaseSymbol(
                    item.symbol || item.yfSymbol
                );
                if (!baseSymbol) return null;
                return [
                    baseSymbol,
                    {
                        ...item,
                        isEtf,
                        baseSymbol,
                    },
                ];
            })
            .filter(Boolean)
    );

    // 월별 데이터 저장용 맵: { "2024-01": { UsStock: { "2024-01-15": [...] }, KrEtf: { ... } } }
    const monthlyData = new Map();

    // 재귀적으로 모든 JSON 파일 찾기
    async function findJsonFiles(dir) {
        const files = [];
        const entries = await fs.readdir(dir, { withFileTypes: true });

        for (const entry of entries) {
            const fullPath = path.join(dir, entry.name);
            if (entry.isDirectory()) {
                // 하위 디렉토리 재귀적으로 탐색
                const subFiles = await findJsonFiles(fullPath);
                files.push(...subFiles);
            } else if (entry.isFile() && entry.name.endsWith('.json')) {
                files.push(fullPath);
            }
        }
        return files;
    }

    const jsonFiles = await findJsonFiles(DATA_DIR);

    for (const filePath of jsonFiles) {
        // [핵심 수정] try...catch를 파일 읽기 및 파싱 부분에만 적용
        let data;
        try {
            const fileContent = await fs.readFile(filePath, 'utf-8');
            data = JSON.parse(fileContent);
        } catch (e) {
            // 파일 읽기/파싱 오류 시 해당 파일만 건너뛰고 계속 진행
            console.error(`Error processing ${filePath}: ${e.message}`);
            continue; // 다음 파일로 넘어감
        }

        const backtestData = data.backtestData || [];
        if (backtestData.length === 0) continue;

        const fileName = path.basename(filePath);
        const yfTickerSymbol = path
            .basename(fileName, '.json')
            .toUpperCase()
            .replace(/-/g, '.');
        const baseSymbol = extractBaseSymbol(yfTickerSymbol);
        const tickerInfo = tickerInfoMap.get(baseSymbol);

        if (!tickerInfo || tickerInfo.upcoming) {
            continue;
        }

        const currency = tickerInfo.currency || 'USD';
        const isEtf = tickerInfo.isEtf || false;

        // 카테고리 결정 (UsStock, UsEtf, KrStock, KrEtf)
        let categoryKey;
        if (currency === 'USD' && !isEtf) categoryKey = 'UsStock';
        else if (currency === 'USD' && isEtf) categoryKey = 'UsEtf';
        else if (currency === 'KRW' && !isEtf) categoryKey = 'KrStock';
        else if (currency === 'KRW' && isEtf) categoryKey = 'KrEtf';
        else categoryKey = 'UsStock'; // fallback

        // backtestData에서 배당 관련 필드가 있는 날짜만 처리
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        // 날짜 범위 설정: 오늘 기준 ±1년
        const oneYearAgo = new Date(today);
        oneYearAgo.setFullYear(today.getFullYear() - 1);
        const oneYearLater = new Date(today);
        oneYearLater.setFullYear(today.getFullYear() + 1);

        backtestData.forEach((entry) => {
            if (!entry || !entry.date) return;

            const dateStr = entry.date;
            const entryDate = new Date(dateStr);

            // 날짜 범위 체크: ±1년 범위 밖이면 스킵
            if (entryDate < oneYearAgo || entryDate > oneYearLater) {
                return;
            }

            const isFuture = entryDate >= today;

            const event = {
                ticker: baseSymbol,
                koName: tickerInfo.koName,
                frequency: tickerInfo.frequency,
                group: tickerInfo.group,
                currency: currency,
            };
            let hasEvent = false;

            const amount =
                entry.amountFixed !== undefined
                    ? entry.amountFixed
                    : entry.amount;

            // 1. 과거/현재: amount 또는 amountFixed가 있는 경우 (실제 지급된 배당)
            // 2. 미래: expected 또는 forecasted가 true인 경우 (예정된 배당)
            if (amount !== undefined && amount !== null) {
                event.amount = amount;
                hasEvent = true;
            } else if (isFuture && entry.expected === true) {
                event.isExpected = true;
                hasEvent = true;
            } else if (isFuture && entry.forecasted === true) {
                event.isForecast = true;
                event.isExpected = true;
                hasEvent = true;
            }

            if (hasEvent) {
                // 월별 데이터에 추가
                const [year, month] = dateStr.split('-');
                const yearMonth = `${year}-${month}`;

                // 해당 월 데이터 초기화
                if (!monthlyData.has(yearMonth)) {
                    monthlyData.set(yearMonth, {
                        UsStock: {},
                        UsEtf: {},
                        KrStock: {},
                        KrEtf: {},
                    });
                }

                const monthData = monthlyData.get(yearMonth);

                // 해당 카테고리의 날짜별 데이터 초기화
                if (!monthData[categoryKey][dateStr]) {
                    monthData[categoryKey][dateStr] = [];
                }

                // 중복 체크 후 추가
                if (
                    !monthData[categoryKey][dateStr].some(
                        (e) => e.ticker === baseSymbol
                    )
                ) {
                    monthData[categoryKey][dateStr].push(event);
                }
            }
        });
    }

    // 월별 파일 저장
    console.log(`\n📅 총 ${monthlyData.size}개 월 데이터 생성\n`);

    let totalFiles = 0;
    let totalEvents = 0;

    for (const [yearMonth, monthData] of monthlyData.entries()) {
        const [year, month] = yearMonth.split('-');
        const yearDir = path.join(CALENDAR_MONTHLY_DIR, year);

        // 연도 디렉토리 생성
        await fs.mkdir(yearDir, { recursive: true });

        // 각 카테고리별로 날짜 정렬
        const sortedMonthData = {
            UsStock: {},
            UsEtf: {},
            KrStock: {},
            KrEtf: {},
        };

        // 카테고리별로 날짜 정렬 및 빈 객체 제거
        for (const [category, dates] of Object.entries(monthData)) {
            if (Object.keys(dates).length > 0) {
                sortedMonthData[category] = Object.keys(dates)
                    .sort()
                    .reduce((acc, dateStr) => {
                        acc[dateStr] = dates[dateStr];
                        return acc;
                    }, {});
            } else {
                // 빈 카테고리는 삭제
                delete sortedMonthData[category];
            }
        }

        // 파일 저장
        const filePath = path.join(yearDir, `${month}.json`);
        await fs.writeFile(
            filePath,
            JSON.stringify(sortedMonthData, null, 2)
        );

        // 통계 계산
        let monthEventCount = 0;
        let totalDates = new Set();

        Object.values(monthData).forEach((dates) => {
            Object.entries(dates).forEach(([dateStr, events]) => {
                totalDates.add(dateStr);
                monthEventCount += events.length;
            });
        });

        totalFiles++;
        totalEvents += monthEventCount;

        console.log(
            `  ✓ ${yearMonth}: ${totalDates.size} dates, ${monthEventCount} events → ${year}/${month}.json`
        );
    }

    console.log(
        `\n🎉 Successfully generated ${totalFiles} monthly calendar files with ${totalEvents} total events.`
    );
}

generateCalendarEvents();
