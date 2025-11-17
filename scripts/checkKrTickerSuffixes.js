import fs from 'fs/promises';
import path from 'path';
import axios from 'axios';

const PUBLIC_DIR = path.resolve(process.cwd(), 'public');
const NAV_FILE_PATH = path.join(PUBLIC_DIR, 'nav.json');
const DEFAULT_SUFFIX_FALLBACKS = ['.KS', '.KQ'];
const YF_HEADERS = { 'User-Agent': 'Mozilla/5.0' };
const DEFAULT_CONCURRENCY = 8;

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const buildSymbolCandidates = (symbol, fallbackSuffixes = []) => {
    const candidates = new Set();
    if (symbol) candidates.add(symbol);

    const dotIndex = symbol?.lastIndexOf('.') ?? -1;
    const base = dotIndex >= 0 ? symbol.slice(0, dotIndex) : symbol;

    (fallbackSuffixes || []).forEach((fallback) => {
        if (!fallback) return;
        const trimmed = String(fallback).trim();
        if (!trimmed) return;

        const isFullSymbol =
            trimmed.includes('.') &&
            !trimmed.startsWith('.') &&
            trimmed.split('.').length === 2;
        if (isFullSymbol) {
            candidates.add(trimmed.toUpperCase());
            return;
        }

        if (!base) return;
        const normalizedSuffix = trimmed.startsWith('.')
            ? trimmed
            : `.${trimmed.replace(/^\./, '')}`;
        candidates.add(`${base}${normalizedSuffix.toUpperCase()}`);
    });

    return Array.from(candidates).filter(Boolean);
};

const parseArguments = () => {
    const options = {
        writeFallbacks: false,
        updatePrimarySymbol: false,
        concurrency: DEFAULT_CONCURRENCY,
        symbols: [],
    };

    process.argv.slice(2).forEach((arg) => {
        if (arg === '--write-fallbacks') {
            options.writeFallbacks = true;
        } else if (arg === '--update-primary') {
            options.updatePrimarySymbol = true;
        } else if (arg.startsWith('--concurrency=')) {
            const value = Number(arg.split('=')[1]);
            if (!Number.isNaN(value) && value > 0) {
                options.concurrency = value;
            }
        } else if (arg === '--help' || arg === '-h') {
            options.help = true;
        } else {
            options.symbols.push(arg.toUpperCase());
        }
    });

    return options;
};

const printHelp = () => {
    console.log(`Usage: node scripts/checkKrTickerSuffixes.js [options] [SYMBOL ...]

Options:
  --write-fallbacks   성공한 대체 심볼을 nav.json의 yfSymbol에 직접 저장합니다.
  --update-primary    대체 접미사가 필요한 경우 symbol 자체를 성공한 후보로 변경합니다.
  --concurrency=N     동시에 조회할 티커 수를 지정합니다. 기본값: ${DEFAULT_CONCURRENCY}
  -h, --help          도움말을 출력합니다.

SYMBOL 인자를 전달하면 해당 티커만 검사합니다 (대소문자 무시).`);
};

const isKoreanTicker = (ticker) => {
    const symbol = String(ticker.symbol || '').toUpperCase();
    if (!symbol) return false;
    if (/\.K[QS]$/.test(symbol)) return true;
    const market = String(ticker.market || '').toUpperCase();
    return ['KOSPI', 'KOSDAQ', 'KRX'].includes(market);
};

const normalizeFallbackList = (existing = []) => {
    if (!Array.isArray(existing)) return [];
    return existing
        .map((suffix) => {
            if (!suffix) return null;
            const trimmed = String(suffix).trim();
            if (!trimmed) return null;
            if (trimmed.startsWith('.')) {
                return trimmed.toUpperCase();
            }
            return trimmed.includes('.')
                ? trimmed.toUpperCase()
                : `.${trimmed.replace(/^\./, '').toUpperCase()}`;
        })
        .filter(Boolean);
};

const probeSymbol = async (symbol) => {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?range=5d&interval=1d`;
    try {
        const { data } = await axios.get(url, { headers: YF_HEADERS });
        if (data.chart?.error) {
            return {
                ok: false,
                status: data.chart.error.code,
                message: data.chart.error.description,
            };
        }
        if (!data.chart?.result?.[0]?.timestamp?.length) {
            return {
                ok: false,
                status: 'EMPTY',
                message: '데이터가 비어있습니다.',
            };
        }
        return { ok: true };
    } catch (error) {
        const status = Number(error.response?.status) || error.code || 'ERR';
        const message =
            error.response?.data?.chart?.error?.description ||
            error.response?.data?.message ||
            error.message;
        return { ok: false, status, message };
    }
};

const deriveFallbackValue = (originalSymbol, resolvedSymbol) => {
    if (!originalSymbol || !resolvedSymbol || originalSymbol === resolvedSymbol)
        return null;
    const base = originalSymbol.split('.')[0];
    if (!base) return null;
    if (resolvedSymbol.startsWith(base)) {
        return resolvedSymbol.slice(base.length);
    }
    return resolvedSymbol;
};

const evaluateTicker = async (ticker) => {
    const originalSymbol = String(ticker.symbol || '').toUpperCase();
    if (!originalSymbol) {
        return {
            ticker,
            success: false,
            originalSymbol,
            resolvedSymbol: null,
            tries: [],
            reason: '심볼 없음',
        };
    }

    // yfSymbol이 이미 있으면 우선 사용
    const existingYfSymbol = ticker.yfSymbol
        ? String(ticker.yfSymbol).toUpperCase()
        : null;

    const suffixCandidates = normalizeFallbackList(DEFAULT_SUFFIX_FALLBACKS);
    const symbolCandidates = buildSymbolCandidates(
        originalSymbol,
        suffixCandidates
    );

    // yfSymbol이 있으면 맨 앞에 추가
    if (existingYfSymbol && !symbolCandidates.includes(existingYfSymbol)) {
        symbolCandidates.unshift(existingYfSymbol);
    }

    const tries = [];

    for (const candidate of symbolCandidates) {
        const result = await probeSymbol(candidate);
        tries.push({ candidate, ...result });
        if (result.ok) {
            return {
                ticker,
                success: true,
                originalSymbol,
                resolvedSymbol: candidate,
                tries,
            };
        }
        if (Number(result.status) !== 404) {
            break;
        }
    }

    return {
        ticker,
        success: false,
        originalSymbol,
        resolvedSymbol: null,
        tries,
    };
};

const runWithConcurrency = async (items, concurrency, worker) => {
    const results = [];
    for (let i = 0; i < items.length; i += concurrency) {
        const chunk = items.slice(i, i + concurrency);
        const chunkResults = await Promise.all(chunk.map(worker));
        results.push(...chunkResults);
        if (i + concurrency < items.length) {
            await delay(400);
        }
    }
    return results;
};

async function main() {
    const options = parseArguments();
    if (options.help) {
        printHelp();
        return;
    }

    const navContent = await fs.readFile(NAV_FILE_PATH, 'utf-8');
    const navData = JSON.parse(navContent);

    let candidates = navData.nav.filter(isKoreanTicker);
    if (options.symbols.length > 0) {
        const symbolSet = new Set(options.symbols);
        candidates = candidates.filter((ticker) =>
            symbolSet.has(String(ticker.symbol || '').toUpperCase())
        );
        if (candidates.length === 0) {
            console.warn('⚠️  요청한 심볼을 nav.json에서 찾지 못했습니다.');
            return;
        }
    }

    console.log(
        `총 ${candidates.length}개의 한국 티커를 검사합니다. (동시 요청 ${options.concurrency}개)`
    );

    const results = await runWithConcurrency(
        candidates,
        options.concurrency,
        (ticker) => evaluateTicker(ticker)
    );

    const ok = [];
    const needFallback = [];
    const failed = [];
    const updates = [];
    let navMutated = false;

    results.forEach((result) => {
        if (!result.success) {
            failed.push(result);
            return;
        }
        if (result.originalSymbol === result.resolvedSymbol) {
            ok.push(result);
        } else {
            needFallback.push(result);
            const fallbackValue = deriveFallbackValue(
                result.originalSymbol,
                result.resolvedSymbol
            );
            const { ticker } = result;

            // yfSymbol에 직접 저장 (000000.KS 형식으로 직접 저장)
            if (
                options.writeFallbacks &&
                result.resolvedSymbol &&
                !options.updatePrimarySymbol &&
                ticker.yfSymbol !== result.resolvedSymbol
            ) {
                ticker.yfSymbol = result.resolvedSymbol;
                navMutated = true;
                updates.push(
                    `• ${result.originalSymbol} -> yfSymbol을 ${result.resolvedSymbol}로 설정`
                );
            }

            if (options.updatePrimarySymbol) {
                ticker.symbol = result.resolvedSymbol;
                navMutated = true;
                updates.push(
                    `• ${result.originalSymbol} 기본 심볼을 ${result.resolvedSymbol} 로 변경`
                );
                // yfSymbol도 함께 업데이트
                if (
                    result.resolvedSymbol &&
                    ticker.yfSymbol !== result.resolvedSymbol
                ) {
                    ticker.yfSymbol = result.resolvedSymbol;
                }
            }
        }
    });

    if (navMutated) {
        await fs.writeFile(NAV_FILE_PATH, JSON.stringify(navData, null, 2));
        console.log(
            `\n✏️  nav.json이 업데이트되었습니다. (${updates.length}건)`
        );
        updates.forEach((line) => console.log(line));
    }

    console.log('\n=== 요약 ===');
    console.log(`✅ 정상 조회: ${ok.length}`);
    console.log(`🟡 대체 접미사 필요: ${needFallback.length}`);
    console.log(`❌ 여전히 실패: ${failed.length}`);

    if (needFallback.length > 0) {
        console.log('\n[대체 접미사가 필요한 티커]');
        needFallback.forEach((item) => {
            const fallbackValue = deriveFallbackValue(
                item.originalSymbol,
                item.resolvedSymbol
            );
            console.log(
                `- ${item.originalSymbol} → ${item.resolvedSymbol} (추천: ${fallbackValue || '없음'})`
            );
        });
    }

    if (failed.length > 0) {
        console.log('\n[실패 티커 상세]');
        failed.forEach((item) => {
            const lastTry = item.tries[item.tries.length - 1];
            const statusText = lastTry ? `${lastTry.status}` : 'N/A';
            console.log(
                `- ${item.originalSymbol || '(미지정)'} (마지막 상태: ${statusText})`
            );
            item.tries.forEach((attempt) =>
                console.log(
                    `   · ${attempt.candidate}: ${attempt.status} ${
                        attempt.message ? `- ${attempt.message}` : ''
                    }`
                )
            );
        });
    }

    console.log('\n검사가 완료되었습니다.');
}

main().catch((error) => {
    console.error('스크립트 실행 중 오류가 발생했습니다:', error);
    process.exit(1);
});
