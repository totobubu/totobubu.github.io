// tasks/generateCalendarEvents.js

import fs from 'fs/promises';
import path from 'path';

const PUBLIC_DIR = path.resolve(process.cwd(), 'public');
const DATA_DIR = path.join(PUBLIC_DIR, 'data');
const NAV_FILE_PATH = path.join(PUBLIC_DIR, 'nav.json');
const CALENDAR_DIR = path.join(PUBLIC_DIR, 'calendar');
const OUTPUT_FILE = path.join(PUBLIC_DIR, 'calendar-events.json'); // 호환성을 위해 유지

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
    console.log('--- Regenerating calendar-events.json from data files ---');

    // calendar 디렉토리 생성
    try {
        await fs.mkdir(CALENDAR_DIR, { recursive: true });
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

    // 카테고리별 이벤트 저장
    const eventsByCategory = {
        'kr-stocks': {},
        'kr-etfs': {},
        'us-stocks': {},
        'us-etfs': {},
    };

    // 호환성을 위한 전체 이벤트
    const eventsByDate = {};

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

        // 카테고리 결정
        let category;
        if (currency === 'KRW' && isEtf) category = 'kr-etfs';
        else if (currency === 'KRW' && !isEtf) category = 'kr-stocks';
        else if (currency === 'USD' && isEtf) category = 'us-etfs';
        else category = 'us-stocks';

        // backtestData에서 배당 관련 필드가 있는 날짜만 처리
        // (project_future_dividends.py가 이미 forecasted 데이터를 생성함)
        const today = new Date();
        today.setHours(0, 0, 0, 0); // 오늘 자정으로 설정

        backtestData.forEach((entry) => {
            if (!entry || !entry.date) return;

            const dateStr = entry.date;
            const entryDate = new Date(dateStr);
            const isFuture = entryDate >= today;

            const event = {
                ticker: baseSymbol,
                koName: tickerInfo.koName,
                frequency: tickerInfo.frequency,
                group: tickerInfo.group,
                isEtf: isEtf,
            };
            let hasEvent = false;

            const amount =
                entry.amountFixed !== undefined
                    ? entry.amountFixed
                    : entry.amount;

            // 1. 과거/현재: amount 또는 amountFixed가 있는 경우 (실제 지급된 배당)
            // 2. 미래: expected 또는 forecasted가 true인 경우 (예정된 배당)
            if (amount !== undefined && amount !== null) {
                // 지나간 일정의 "amountFixed" or "amount"
                event.amount = amount;
                hasEvent = true;
            } else if (isFuture && entry.expected === true) {
                // 미래의 "expected": true
                event.isExpected = true;
                hasEvent = true;
            } else if (isFuture && entry.forecasted === true) {
                // 미래의 "forecasted": true (project_future_dividends.py가 생성)
                event.isForecast = true;
                event.isExpected = true;
                hasEvent = true;
            }

            if (hasEvent) {
                // 카테고리별 파일에 추가
                if (!eventsByCategory[category][dateStr]) {
                    eventsByCategory[category][dateStr] = [];
                }
                if (
                    !eventsByCategory[category][dateStr].some(
                        (e) => e.ticker === baseSymbol
                    )
                ) {
                    eventsByCategory[category][dateStr].push(event);
                }

                // 호환성을 위한 전체 파일에도 추가
                if (!eventsByDate[dateStr]) eventsByDate[dateStr] = {};
                if (!eventsByDate[dateStr][currency])
                    eventsByDate[dateStr][currency] = [];
                if (
                    !eventsByDate[dateStr][currency].some(
                        (e) => e.ticker === baseSymbol
                    )
                ) {
                    eventsByDate[dateStr][currency].push(event);
                }
            }
        });

        // project_future_dividends.py가 이미 forecasted 데이터를 생성하므로
        // 여기서는 backtestData의 forecasted 필드만 읽어서 처리하면 됨
    }

    // 카테고리별 파일 정렬 및 저장
    const outputFiles = {
        'kr-stocks': path.join(CALENDAR_DIR, 'calendar-events-kr-stocks.json'),
        'kr-etfs': path.join(CALENDAR_DIR, 'calendar-events-kr-etfs.json'),
        'us-stocks': path.join(CALENDAR_DIR, 'calendar-events-us-stocks.json'),
        'us-etfs': path.join(CALENDAR_DIR, 'calendar-events-us-etfs.json'),
    };

    for (const [category, filePath] of Object.entries(outputFiles)) {
        const sortedEvents = Object.keys(eventsByCategory[category])
            .sort()
            .reduce((acc, key) => {
                acc[key] = eventsByCategory[category][key];
                return acc;
            }, {});

        await fs.writeFile(filePath, JSON.stringify(sortedEvents, null, 2));
        const eventCount = Object.values(sortedEvents).reduce(
            (sum, events) => sum + events.length,
            0
        );
        console.log(
            `  ✓ ${category}: ${Object.keys(sortedEvents).length} dates, ${eventCount} events → ${path.basename(filePath)}`
        );
    }

    // 호환성을 위한 전체 파일도 저장
    const sortedEventsByDate = Object.keys(eventsByDate)
        .sort()
        .reduce((acc, key) => {
            acc[key] = eventsByDate[key];
            return acc;
        }, {});

    await fs.writeFile(
        OUTPUT_FILE,
        JSON.stringify(sortedEventsByDate, null, 2)
    );
    console.log(
        `🎉 Successfully generated calendar events files with ${Object.keys(sortedEventsByDate).length} total dates.`
    );
}

generateCalendarEvents();
