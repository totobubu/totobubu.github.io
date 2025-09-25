// api/getBacktestData.js (최종 안정화 버전)

import yahooFinance from 'yahoo-finance2';

export default async function handler(req, res) {
    // CORS 헤더 설정
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    const { symbols, from, to } = req.query;
    if (!symbols || !from || !to) {
        return res
            .status(400)
            .json({ error: 'Symbols, from, and to parameters are required' });
    }

    // Vercel 환경에서는 파일 시스템 접근이 불가능하므로, 환율은 항상 API로 호출
    const exchangeRatesPromise = yahooFinance
        .historical('USDKRW=X', { period1: from, period2: to })
        .then((rates) =>
            rates.map((r) => ({
                date: r.date.toISOString().split('T')[0],
                rate: r.close,
            }))
        )
        .catch((e) => {
            console.error('환율 데이터 조회 실패:', e.message);
            return []; // 환율 조회 실패 시 빈 배열 반환
        });

    const symbolArray = symbols.split(',');

    try {
        const resultsPromises = symbolArray.map(async (symbol) => {
            try {
                // [핵심] historical API 한 번만 호출하여 모든 것을 해결
                const historicalData = await yahooFinance.historical(symbol, {
                    period1: from,
                    period2: to,
                    interval: '1d',
                    events: 'history|div|split',
                });

                if (!historicalData || historicalData.length === 0) {
                    // 데이터가 없는 경우도 정상 처리
                    return {
                        symbol,
                        firstTradeDate: null,
                        prices: [],
                        dividends: [],
                        splits: [],
                    };
                }

                const firstTradeDate = historicalData[0].date
                    .toISOString()
                    .split('T')[0];
                const prices = historicalData.filter(
                    (d) => d && typeof d.close === 'number'
                );
                const dividends = historicalData.filter(
                    (d) => d && d.dividends
                );
                const splits = historicalData.filter((d) => d && d.stockSplits);

                return {
                    symbol,
                    firstTradeDate,
                    prices: prices.map((p) => ({
                        date: p.date.toISOString().split('T')[0],
                        open: p.open,
                        close: p.close,
                    })),
                    dividends: dividends.map((d) => ({
                        date: d.date.toISOString().split('T')[0],
                        amount: d.dividends,
                    })),
                    splits: splits.map((s) => ({
                        date: s.date.toISOString().split('T')[0],
                        ratio: s.stockSplits,
                    })),
                };
            } catch (e) {
                // 개별 심볼 조회 실패 시 에러 객체 반환
                console.error(`[API] ${symbol} 데이터 조회 실패:`, e.message);
                return {
                    symbol,
                    error: e.message,
                    prices: [],
                    dividends: [],
                    splits: [],
                };
            }
        });

        const [tickerData, exchangeRatesData] = await Promise.all([
            Promise.all(resultsPromises),
            exchangeRatesPromise,
        ]);

        res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate');
        return res.status(200).json({
            tickerData,
            exchangeRates: exchangeRatesData,
        });
    } catch (error) {
        return res.status(500).json({ error: error.message });
    }
}
