import yahooFinance from 'yahoo-finance2';

export default async function handler(req, res) {
    const { symbol, from, to } = req.query;
    if (!symbol || !from || !to) {
        return res.status(400).json({ error: 'Parameters required' });
    }
    try {
        const fromDate = new Date(from);
        const toDate = new Date(to);

        // [핵심 1] 날짜 유효성 검사 추가
        if (isNaN(fromDate.getTime()) || isNaN(toDate.getTime())) {
            throw new Error(
                `Invalid date format received. From: ${from}, To: ${to}`
            );
        }

        // [핵심 2] 시작일이 종료일보다 늦으면 에러 처리
        if (fromDate > toDate) {
            throw new Error('Start date cannot be after end date.');
        }

        const queryOptions = {
            period1: fromDate,
            period2: toDate,
            events: 'div',
        };
        const results = await yahooFinance.historical(symbol, queryOptions);

        res.status(200).json({ symbol, dividends: results });
    } catch (error) {
        res.status(200).json({
            symbol,
            dividends: [],
            error: `Failed for symbol ${symbol}: ${error.message}`,
            query: req.query,
        });
    }
}
