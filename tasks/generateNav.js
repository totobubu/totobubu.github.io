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
const brandMappingFile = path.join(publicDir, 'nav', 'kr-brand.json');

// --- [핵심 수정 1] 한국 ETF 운용사 이름과 로고 파일명 매핑 객체 추가 ---
const koreanEtfBrandByCompany = {
    미래에셋자산운용: 'tiger',
    삼성자산운용: 'kodex',
    kb증권: 'kbsec',
    kb자산운용: 'kbsec',
    한국투자신탁운용: 'ace',
    엔에이치아문디자산운용: 'hanaro',
    'NH-Amundi자산운용': 'hanaro',
    신한자산운용: 'sol',
    비엔케이자산운용: 'bnk',
    키움증권: 'kiwoom',
    키움투자자산운용: 'kiwoom',
    한화자산운용: 'arirang',
    대신자산운용: 'daishin',
    '대신 증권': 'daishin',
    흥국자산운용: 'heungkuk',
};

const koreanCorporateBrandPatterns = [
    {
        regex: /^(?:lg|엘지)/,
        brandSlug: 'lg',
    },
    {
        regex: /^(?:gs|지에스)/,
        brandSlug: 'gs',
    },
    {
        regex: /^한화/,
        brandSlug: 'hanwha',
    },
    {
        regex: /^sk/,
        brandSlug: 'sk',
    },
    {
        regex: /^(?:삼성|samsung)/,
        brandSlug: 'samsung',
    },
    {
        regex: /^(?:포스코|posco)/,
        brandSlug: 'posco',
    },
    {
        regex: /^(?:두산|doosan)/,
        brandSlug: 'doosan',
    },
    {
        regex: /^(?:교보|kyobo)/,
        brandSlug: 'kyobo',
    },
    {
        regex: /^(?:롯데|lotte)/,
        brandSlug: 'lotte',
    },
    {
        regex: /^cj/,
        brandSlug: 'cj',
    },
];

function normalizeKoreanIdentifier(value) {
    if (!value) return '';
    return value
        .toString()
        .trim()
        .toLowerCase()
        .replace(/\(주\)/g, '')
        .replace(/㈜/g, '')
        .replace(/주식회사/g, '')
        .replace(/[\s·'"()]/g, '')
        .replace(/[-_/]/g, '');
}

const normalizedKoreanEtfBrandByCompany = new Map(
    Object.entries(koreanEtfBrandByCompany).map(([key, value]) => [
        normalizeKoreanIdentifier(key),
        value,
    ])
);

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

function resolveKoreanEtfBrandSlug(name) {
    if (!name) return null;
    const normalized = normalizeKoreanIdentifier(name);
    if (!normalized) return null;
    return normalizedKoreanEtfBrandByCompany.get(normalized) || null;
}

function resolveKoreanCorporateBrandSlug(name) {
    if (!name) return null;
    const normalized = normalizeKoreanIdentifier(name);
    if (!normalized) return null;

    for (const { regex, brandSlug } of koreanCorporateBrandPatterns) {
        if (regex.test(normalized)) {
            return brandSlug;
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

function resolveKoreanEtfBrandSlugFromTicker(ticker) {
    if (!ticker) return null;
    const candidates = [ticker.company, ticker.koName, ticker.longName];

    for (const candidate of candidates) {
        const slug = resolveKoreanEtfBrandSlug(candidate);
        if (slug) {
            return slug;
        }
    }

    const combined = candidates.filter(Boolean).join(' ');
    if (!combined) {
        return null;
    }

    for (const { regex, company } of koreanEtfCompanyPatterns) {
        if (regex.test(combined)) {
            return resolveKoreanEtfBrandSlug(company);
        }
    }

    return null;
}

function resolveKoreanCorporateBrandSlugFromTicker(ticker) {
    if (!ticker) return null;
    const candidates = [ticker.company, ticker.koName, ticker.longName];

    for (const candidate of candidates) {
        const slug = resolveKoreanCorporateBrandSlug(candidate);
        if (slug) {
            return slug;
        }
    }

    return null;
}
// --- // ---

function normalizeToFilename(name) {
    if (!name) return null;
    return name.toLowerCase().replace(/[.,']/g, '').replace(/\s+/g, '-');
}

function sanitizeBrandSlug(value) {
    const normalized = normalizeToFilename(value);
    if (!normalized) return null;
    return normalized.replace(/^brand-/, '').replace(/^etf-/, '');
}

async function loadSymbolBrandMap() {
    try {
        const fileContent = await fs.readFile(brandMappingFile, 'utf8');
        const parsed = JSON.parse(fileContent);
        const symbolToBrand = new Map();

        const registerMapping = (brandValue, symbols) => {
            const brandSlug = sanitizeBrandSlug(brandValue);
            if (!brandSlug || !Array.isArray(symbols)) {
                return;
            }

            symbols.forEach((symbol) => {
                if (typeof symbol !== 'string') return;
                const trimmed = symbol.trim().toUpperCase();
                if (!trimmed) return;
                symbolToBrand.set(trimmed, brandSlug);
            });
        };

        if (Array.isArray(parsed?.brands)) {
            parsed.brands.forEach((entry) => {
                if (!entry) return;
                const brandValue = entry.slug || entry.brand || entry.name;
                registerMapping(brandValue, entry.symbols);
            });
        } else if (parsed && typeof parsed === 'object') {
            Object.entries(parsed).forEach(([brandValue, symbols]) => {
                registerMapping(brandValue, symbols);
            });
        }

        return symbolToBrand;
    } catch (error) {
        if (error.code !== 'ENOENT') {
            console.warn(`⚠️ brand.json 로드 실패: ${error.message}`);
        }
        return new Map();
    }
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

        if (
            normalizedName &&
            !normalizedName.startsWith('company-') &&
            (dir === logosCompanyDir || dir === logosDir)
        ) {
            candidateNames.add(`company-${normalizedName}`);
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
    const symbolBrandMap = await loadSymbolBrandMap();
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

        const symbolKey = (processedTicker.symbol || ticker.symbol || '')
            .toUpperCase()
            .trim();
        const marketUpper = (processedTicker.market || '').toUpperCase();

        if (
            (!processedTicker.company || processedTicker.company === null) &&
            ['KOSPI', 'KOSDAQ'].includes(marketUpper)
        ) {
            const inferredCompany = inferKoreanEtfCompany(processedTicker);
            if (inferredCompany) {
                processedTicker.company = inferredCompany;
            }
        }

        const logoAttempts = [];

        const brandSlugFromMapping = symbolKey
            ? symbolBrandMap.get(symbolKey)
            : null;
        if (brandSlugFromMapping) {
            logoAttempts.push({
                name: `brand-${brandSlugFromMapping}`,
                category: 'korea',
            });
        }

        if (['KOSPI', 'KOSDAQ'].includes(marketUpper)) {
            const etfBrandSlug =
                resolveKoreanEtfBrandSlugFromTicker(processedTicker);
            if (etfBrandSlug) {
                logoAttempts.push({
                    name: `etf-${etfBrandSlug}`,
                    category: 'korea',
                });
            }

            const corporateBrandSlug =
                resolveKoreanCorporateBrandSlugFromTicker(processedTicker);
            if (corporateBrandSlug) {
                logoAttempts.push({
                    name: `brand-${corporateBrandSlug}`,
                    category: 'korea',
                });
            }
        }

        const globalBrandKey = resolveGlobalBrandLogoKey(
            processedTicker.company
        );
        if (globalBrandKey) {
            logoAttempts.push({
                name: globalBrandKey,
                category: 'company',
            });
        }

        const fallbackName = processedTicker.company || processedTicker.symbol;
        if (fallbackName) {
            logoAttempts.push({
                name: fallbackName,
                category: 'company',
            });
        }

        let resolvedLogoPath = null;
        const attemptedKeys = [];
        const attemptDedup = new Set();

        for (const attempt of logoAttempts) {
            const normalizedName = normalizeToFilename(attempt.name);
            if (!normalizedName) continue;

            const dedupKey = `${attempt.category}:${normalizedName}`;
            if (attemptDedup.has(dedupKey)) continue;
            attemptDedup.add(dedupKey);
            attemptedKeys.push(dedupKey);

            const logoPath = findLogoFile(normalizedName, attempt.category);
            if (logoPath) {
                resolvedLogoPath = logoPath;
                break;
            }
        }

        if (resolvedLogoPath) {
            processedTicker.logo = resolvedLogoPath;
        } else {
            processedTicker.logo = null;
            if (attemptedKeys.length) {
                console.log(
                    `🔸 ${ticker.symbol}: 로고 없음. 시도한 후보: ${attemptedKeys.join(', ')}`
                );
            }

            const failureName =
                fallbackName ||
                logoAttempts[logoAttempts.length - 1]?.name ||
                null;
            const normalizedFailureName = normalizeToFilename(failureName);

            failedLogoMatches.push({
                symbol: ticker.symbol,
                company: ticker.company || null,
                market: ticker.market || null,
                searchName: failureName,
                normalizedSearchName: normalizedFailureName,
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
