// tasks/generateNav.js
import fs from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';

const rootDir = process.cwd();
const publicDir = path.join(rootDir, 'public');
const navDir = path.join(publicDir, 'nav');
const dataDir = path.join(publicDir, 'data');
const logosDir = path.join(publicDir, 'logos');
const logosCompanyDir = path.join(logosDir, 'company');
const logosKoreaDir = path.join(logosDir, 'korea');
const outputFile = path.join(publicDir, 'nav.json');
const missingLogosFile = path.join(publicDir, 'missing-logos.json');

// --- [핵심 수정 1] 한국 ETF 운용사 이름과 로고 파일명 매핑 객체 추가 ---
const koreanEtfBrandMap = {
    미래에셋자산운용: 'korea-tiger',
    삼성자산운용: 'korea-kodex',
    kb증권: 'korea-kbsec',
    kb자산운용: 'korea-kbsec',

    한국투자신탁운용: 'korea-ace',
    엔에이치아문디자산운용: 'korea-hanaro',
    'NH-Amundi자산운용': 'korea-hanaro',

    신한자산운용: 'korea-sol',
    타임폴리오자산운용: 'korea-time',
    비엔케이자산운용: 'korea-bnk',
    키움증권: 'korea-kiwoom',
    키움투자자산운용: 'korea-kiwoom',
    한화자산운용: 'korea-hanwha',
    한화: 'korea-hanwha',
    '한화생명': 'korea-hanwha',
    '한화생명보험': 'korea-hanwha',
    '한화투자증권': 'korea-hanwha',
    '한화솔루션': 'korea-hanwha',
    '한화시스템': 'korea-hanwha',
    '한화에어로스페이스': 'korea-hanwha',
    '한화호텔앤드리조트': 'korea-hanwha',
    '한화손해보험': 'korea-hanwha',
    '한화생명보험주식회사': 'korea-hanwha',
    '한화생명보험㈜': 'korea-hanwha',
    sk: 'korea-sk',
    'sk하이닉스': 'korea-sk',
    'sk이노베이션': 'korea-sk',
    'sk텔레콤': 'korea-sk',
    'sk이노베이션㈜': 'korea-sk',
    'sk케미칼': 'korea-sk',
    'skc': 'korea-sk',
    'sk바이오팜': 'korea-sk',
    'sk바이오사이언스': 'korea-sk',
    'sk네트웍스': 'korea-sk',
    'sk디스커버리': 'korea-sk',
    'sk가스': 'korea-sk',
    'sk증권': 'korea-sk',
    'sk에너지': 'korea-sk',
    'sk실트론': 'korea-sk',
    'sk인천석유화학': 'korea-sk',
    'sk종합화학': 'korea-sk',
    삼성: 'korea-samsung',
    '삼성전자': 'korea-samsung',
    '삼성생명': 'korea-samsung',
    '삼성화재': 'korea-samsung',
    '삼성카드': 'korea-samsung',
    '삼성증권': 'korea-samsung',
    '삼성물산': 'korea-samsung',
    '삼성sdi': 'korea-samsung',
    '삼성바이오로직스': 'korea-samsung',
    '삼성엔지니어링': 'korea-samsung',
    '삼성전기': 'korea-samsung',
    '삼성중공업': 'korea-samsung',
    'samsung electronics': 'korea-samsung',
    'samsung life insurance': 'korea-samsung',
    'samsung sdi': 'korea-samsung',
    포스코: 'korea-posco',
    '포스코홀딩스': 'korea-posco',
    '포스코인터내셔널': 'korea-posco',
    '포스코퓨처엠': 'korea-posco',
    'posco holdings': 'korea-posco',
    'posco international': 'korea-posco',
    두산: 'korea-doosan',
    '두산에너빌리티': 'korea-doosan',
    '두산밥캣': 'korea-doosan',
    '두산퓨얼셀': 'korea-doosan',
    '두산퓨얼셀㈜': 'korea-doosan',
    doosan: 'korea-doosan',
    교보: 'korea-kyobo',
    '교보증권': 'korea-kyobo',
    '교보생명': 'korea-kyobo',
    '교보라이프플래닛': 'korea-kyobo',
    '교보악사자산운용': 'korea-kyobo',
    'kyobo securities': 'korea-kyobo',
    'kyobo life': 'korea-kyobo',
    롯데: 'korea-lotte',
    '롯데케미칼': 'korea-lotte',
    '롯데칠성': 'korea-lotte',
    '롯데제과': 'korea-lotte',
    '롯데쇼핑': 'korea-lotte',
    '롯데렌탈': 'korea-lotte',
    '롯데하이마트': 'korea-lotte',
    '롯데정밀화학': 'korea-lotte',
    '롯데손해보험': 'korea-lotte',
    '롯데홈쇼핑': 'korea-lotte',
    'lotte chemical': 'korea-lotte',
    'lotte shopping': 'korea-lotte',
    cj: 'korea-cj',
    'cj제일제당': 'korea-cj',
    'cj대한통운': 'korea-cj',
    'cj프레시웨이': 'korea-cj',
    'cj올리브영': 'korea-cj',
    'cj올리브네트웍스': 'korea-cj',
    'cj씨지브이': 'korea-cj',
    'cj헬로': 'korea-cj',
    'cj푸드빌': 'korea-cj',
    'cj라이브시티': 'korea-cj',
    'cj logistics': 'korea-cj',
    'cj cheiljedang': 'korea-cj',

    대신자산운용: 'korea-daishin',
    '대신 증권': 'korea-daishin',
    흥국자산운용: 'korea-heungkuk',
    lg: 'korea-lg',
    'lg전자': 'korea-lg',
    'lg화학': 'korea-lg',
    'lg이노텍': 'korea-lg',
    'lg에너지솔루션': 'korea-lg',
    'lg생활건강': 'korea-lg',
    '㈜lg': 'korea-lg',
    gs: 'korea-gs',
    'gs리테일': 'korea-gs',
    'gs리테일㈜': 'korea-gs',
    'gs건설': 'korea-gs',
    'gs에너지': 'korea-gs',
    'gs칼텍스': 'korea-gs',
    'gs그룹': 'korea-gs',
    'gs리테일주식회사': 'korea-gs',
    // 필요한 다른 운용사들을 여기에 추가할 수 있습니다.
};

const koreanCorporateBrandPatterns = [
    {
        regex: /^(?:㈜)?\s*(?:lg|엘지)(?:\s|\b)/iu,
        brandKey: 'korea-lg',
    },
    {
        regex: /^(?:gs|지에스)(?:\s|\b)/iu,
        brandKey: 'korea-gs',
    },
    {
        regex: /^(?:한화)(?:\s|\b)/iu,
        brandKey: 'korea-hanwha',
    },
    {
        regex: /^(?:sk)(?:\s|\b)/iu,
        brandKey: 'korea-sk',
    },
    {
        regex: /^(?:삼성|samsung)(?:\s|\b)/iu,
        brandKey: 'korea-samsung',
    },
    {
        regex: /^(?:포스코|posco)(?:\s|\b)/iu,
        brandKey: 'korea-posco',
    },
    {
        regex: /^(?:두산|doosan)(?:\s|\b)/iu,
        brandKey: 'korea-doosan',
    },
    {
        regex: /^(?:교보|kyobo)(?:\s|\b)/iu,
        brandKey: 'korea-kyobo',
    },
    {
        regex: /^(?:롯데|lotte)(?:\s|\b)/iu,
        brandKey: 'korea-lotte',
    },
    {
        regex: /^(?:cj)(?:\s|\b)/iu,
        brandKey: 'korea-cj',
    },
];

const globalBrandLogoMap = new Map(
    [
        ['SPDR', 'company-spdr'],
        ['SPDR ETFs', 'company-spdr'],
        ['SPDR STATE STREET GLOBAL ADVISORS', 'company-spdr'],
        ['STATE STREET GLOBAL ADVISORS', 'company-spdr'],
        ['GOLDMAN SACHS', 'company-goldman-sachs'],
        ['GOLDMAN', 'company-goldman-sachs'],
        ['GOLDMAN SACHS GROUP', 'company-goldman-sachs'],
        ['GOLDMAN SACHS ASSET MANAGEMENT', 'company-goldman-sachs'],
        ['GOLDMAN SACHS ACCESS', 'company-goldman-sachs'],
        ['ARK', 'company-ark'],
        ['ARK ETF TRUST', 'company-ark'],
        ['ARK INVESTMENT MANAGEMENT', 'company-ark'],
        ['JPMORGAN', 'company-jpmorgan'],
        ['J.P. MORGAN', 'company-jpmorgan'],
        ['JPMORGAN CHASE', 'company-jpmorgan'],
        ['JPMORGAN CHASE & CO.', 'company-jpmorgan'],
        ['JPMAM', 'company-jpmorgan'],
        ['J.P. MORGAN ASSET MANAGEMENT', 'company-jpmorgan'],
        ['TIDAL', 'company-tidal'],
        ['TIDAL ETF SERVICES', 'company-tidal'],
        ['TIDAL FINANCIAL GROUP', 'company-tidal'],
        ['DIREXION', 'company-direxion'],
        ['DIREXION FUNDS', 'company-direxion'],
        ['YIELDMAX', 'company-yieldmax'],
        ['YIELDMAX ETFs', 'company-yieldmax'],
        ['DEFIANCE', 'company-defiance'],
        ['DEFIANCE ETFs', 'company-defiance'],
        ['FIRST TRUST', 'company-first-trust'],
        ['FIRST TRUST ADVISORS', 'company-first-trust'],
        ['FIRST TRUST PORTFOLIO', 'company-first-trust'],
        ['FIRST TRUST PORTFOLIOS', 'company-first-trust'],
        ['FT', 'company-first-trust'],
        ['FIRST', 'company-first-trust'],
    ].map(([key, value]) => [key.toLowerCase(), value])
);

const globalCompanyAliasMap = new Map(
    [
        ['ACCESS', 'Goldman Sachs'],
        ['GOLDMAN SACHS ACCESS', 'Goldman Sachs'],
        ['GOLDMAN SACHS ASSET MANAGEMENT', 'Goldman Sachs'],
        ['GOLDMAN SACHS GROUP', 'Goldman Sachs'],
        ['GOLDMAN SACHS', 'Goldman Sachs'],
        ['GOLDMAN', 'Goldman Sachs'],
        ['FIRST', 'First Trust'],
    ].map(([key, value]) => [key.toLowerCase(), value])
);

function resolveCompanyAlias(companyName) {
    if (!companyName) return null;
    return globalCompanyAliasMap.get(companyName.toLowerCase()) || null;
}

const koreanEtfCompanyPatterns = [
    { regex: /\bTIGER\b|미래에셋/iu, company: '미래에셋자산운용' },
    { regex: /\bKODEX\b/iu, company: '삼성자산운용' },
    {
        regex: /\bKBSTAR\b|\bKB STAR\b|KB스타/iu,
        company: 'KB자산운용',
    },
    {
        regex: /\bACE\b|\bKINDEX\b|한국투자/iu,
        company: '한국투자신탁운용',
    },
    { regex: /\bHANARO\b/iu, company: '엔에이치아문디자산운용' },
    { regex: /\bSOL\b/iu, company: '신한자산운용' },
    { regex: /TIMEFOLIO/iu, company: '타임폴리오자산운용' },
    { regex: /\bBNK\b/iu, company: '비엔케이자산운용' },
    { regex: /ARIRANG/iu, company: '한화자산운용' },
    { regex: /KOSEF/iu, company: '한국투자신탁운용' },
    { regex: /KIWOOM|키움/iu, company: '키움증권' },
    { regex: /\bRISE\b/iu, company: 'kb자산운용' },
    { regex: /\bPLUS\b/iu, company: '한화자산운용' },
];

function resolveKoreanBrandLogoKey(companyName) {
    if (!companyName) return null;
    const key = companyName.toLowerCase();
    if (koreanEtfBrandMap[key]) {
        return koreanEtfBrandMap[key];
    }
    if (koreanEtfBrandMap[companyName]) {
        return koreanEtfBrandMap[companyName];
    }

    for (const { regex, brandKey } of koreanCorporateBrandPatterns) {
        if (regex.test(companyName)) {
            return brandKey;
        }
    }

    return null;
}

function resolveGlobalBrandLogoKey(companyName) {
    if (!companyName) return null;
    return globalBrandLogoMap.get(companyName.trim().toLowerCase()) || null;
}

function inferKoreanEtfCompany(ticker) {
    const target = [ticker.company, ticker.koName, ticker.longName]
        .filter(Boolean)
        .join(' ');
    if (!target) return null;

    for (const { regex, company } of koreanEtfCompanyPatterns) {
        if (regex.test(target)) {
            return company;
        }
    }
    return null;
}
// --- // ---

function normalizeToFilename(name) {
    if (!name) return null;
    return name.toLowerCase().replace(/[.,']/g, '').replace(/\s+/g, '-');
}

function findLogoFile(normalizedName, category = 'company') {
    if (!normalizedName) return null;

    const supportedExtensions = [
        '.svg',
        '.png',
        '.webp',
        '.jpg',
        '.jpeg',
        '.ico',
    ];

    const searchTargets = [];

    const addTarget = (dir, relativePrefix) => {
        if (!dir) return;
        if (searchTargets.some((target) => target.dir === dir)) return;
        searchTargets.push({ dir, relativePrefix });
    };

    if (category === 'korea') {
        addTarget(logosKoreaDir, 'logos/korea/');
    }

    if (category === 'company') {
        addTarget(logosCompanyDir, 'logos/company/');
    }

    addTarget(logosDir, 'logos/');

    for (const { dir, relativePrefix } of searchTargets) {
        const candidateNames = new Set([normalizedName]);

        if (normalizedName && !normalizedName.startsWith('company-')) {
            if (dir === logosCompanyDir || dir === logosDir) {
                candidateNames.add(`company-${normalizedName}`);
            }
        }

        for (const name of candidateNames) {
            for (const ext of supportedExtensions) {
                const filePath = path.join(dir, `${name}${ext}`);
                if (existsSync(filePath)) {
                    return `${relativePrefix}${name}${ext}`;
                }
            }
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
    const failedLogoMatches = [];
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

        const alias = resolveCompanyAlias(processedTicker.company);
        if (alias) {
            processedTicker.company = alias;
        }

        if (
            (!processedTicker.company || processedTicker.company === null) &&
            ['KOSPI', 'KOSDAQ'].includes(
                (processedTicker.market || '').toUpperCase()
            )
        ) {
            const inferredCompany = inferKoreanEtfCompany(processedTicker);
            if (inferredCompany) {
                processedTicker.company = inferredCompany;
            }
        }

        // --- [핵심 수정 2] 로고 검색 이름 결정 로직 수정 ---
        let nameForLogoSearch;
        let logoCategory = 'company';
        const koreanBrandKey = resolveKoreanBrandLogoKey(
            processedTicker.company
        );
        if (koreanBrandKey) {
            // 매핑 객체에 한국 운용사 이름이 있으면, 매핑된 영어 이름을 사용
            nameForLogoSearch = koreanBrandKey;
            logoCategory = 'korea';
        } else {
            const globalBrandKey = resolveGlobalBrandLogoKey(
                processedTicker.company
            );
            if (globalBrandKey) {
                nameForLogoSearch = globalBrandKey;
            } else {
                // 그 외의 경우(미국 ETF, 로고 없는 종목 등) 기존 로직 사용
                nameForLogoSearch =
                    processedTicker.company || processedTicker.symbol;
            }
        }
        // --- // ---

        const normalizedName = normalizeToFilename(nameForLogoSearch);
        const logoPath = findLogoFile(normalizedName, logoCategory);

        if (logoPath) {
            processedTicker.logo = logoPath;
        } else if (nameForLogoSearch) {
            console.log(
                `🔸 ${ticker.symbol}: 로고 없음. 검색 시도한 이름: "${normalizedName}"`
            );
            processedTicker.logo = null;
            failedLogoMatches.push({
                symbol: ticker.symbol,
                company: ticker.company || null,
                market: ticker.market || null,
                searchName: nameForLogoSearch,
                normalizedSearchName: normalizedName,
            });
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
                    '6M',
                    '1Y',
                    '3Y',
                    '5Y',
                    '10Y',
                    '15Y',
                    '20Y',
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

    try {
        const failedSummary = {
            generatedAt: new Date().toISOString(),
            count: failedLogoMatches.length,
            items: failedLogoMatches,
        };
        await fs.writeFile(
            missingLogosFile,
            JSON.stringify(failedSummary, null, 2)
        );
        console.log(
            failedLogoMatches.length
                ? `⚠️ 매칭 실패 로고 ${failedLogoMatches.length}건이 ${missingLogosFile} 에 기록되었습니다.`
                : `✅ 모든 로고가 성공적으로 매칭되어 ${missingLogosFile} 에 빈 목록이 저장되었습니다.`
        );
    } catch (error) {
        console.error(
            `❌ 로고 매칭 실패 내역 저장 중 오류 발생: ${error.message}`
        );
    }
}

generateNavJson();
