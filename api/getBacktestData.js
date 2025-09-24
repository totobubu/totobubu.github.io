// api/getBacktestData.js

import yahooFinance from 'yahoo-finance2';

// yahoo-finance2의 기본 유효성 검사를 비활성화하여 유연성을 높입니다.
yahooFinance.setGlobalConfig({
    validation: {
        logErrors: false, // 콘솔에 불필요한 로그를 찍지 않음
        failOnUnknownProperties: false,
        failOnInvalidData: false,
    },
});

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    const { symbols, from, to } = req.query;
    if (!symbols || !from || !to) {
        return res.status(400).json({ error: 'Symbols, from, and to parameters are required' });
    }
    
    // [핵심 수정 1] 날짜 유효성 검사 및 보정
    let startDate = new Date(from);
    let endDate = new Date(to);
    const today = new Date();

    // 종료일이 미래이면 오늘 날짜로 보정
    if (endDate > today) {
        endDate = today;
    }
    // 시작일이 종료일보다 미래이면, 시작일을 종료일로 맞춤 (결과는 1일치 데이터)
    if (startDate > endDate) {
        startDate = endDate;
    }

    const period1 = startDate.toISOString().split('T')[0];
    const period2 = endDate.toISOString().split('T')[0];
    
    const symbolArray = symbols.split(',');

    try {
        const results = await Promise.all(
            symbolArray.map(async (symbol) => {
                try {
                    const quote = await yahooFinance.quote(symbol, { fields: ['firstTradeDateMilliseconds'] });
                    const firstTradeDate = quote.firstTradeDateMilliseconds ? new Date(quote.firstTradeDateMilliseconds) : null;
                    
                    // [핵심 수정 2] 각 티커별로 유효한 데이터 시작일을 다시 계산
                    let effectiveFrom = startDate;
                    if (firstTradeDate && firstTradeDate > startDate) {
                        effectiveFrom = firstTradeDate;
                    }

                    // 만약 최종 시작일이 종료일보다 미래이면, 데이터를 가져올 수 없으므로 빈 배열 반환
                    if (effectiveFrom > endDate) {
                        return { symbol, firstTradeDate: firstTradeDate?.toISOString().split('T')[0], prices: [], dividends: [], splits: [] };
                    }
                    
                    const effectivePeriod1 = effectiveFrom.toISOString().split('T')[0];

                    const historicalData = await yahooFinance.historical(symbol, {
                        period1: effectivePeriod1,
                        period2: period2,
                        interval: '1d',
                        events: 'history|div|split',
                    });

                    // ... (이후의 데이터 파싱 로직은 이전과 동일)
                    const prices = historicalData.filter((d) => 'close' in d);
                    // ...

                    return {
                        symbol,
                        firstTradeDate: firstTradeDate?.toISOString().split('T')[0],
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
                    return { symbol, error: e.message, prices: [], dividends: [], splits: [] };
                }
            })
        );
        
        let exchangeRatesData = [];
        // 환율 데이터 요청도 보정된 날짜 사용
        const krwUsdRate = await yahooFinance.historical('USDKRW=X', { period1, period2 });
        exchangeRatesData = krwUsdRate.map((r) => ({ date: r.date.toISOString().split('T')[0], rate: r.close }));

        res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate');
        return res.status(200).json({
            tickerData: results,
            exchangeRates: exchangeRatesData,
        });

    } catch (error) {
        return res.status(500).json({ error: error.message });
    }
}
