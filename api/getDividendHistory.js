import yahooFinance from 'yahoo-finance2';

export default async function handler(req, res) {
    const { symbol, from, to } = req.query;
    if (!symbol || !from || !to) {
        return res.status(400).json({ error: 'Parameters required' });
    }
    try {
        // [핵심 수정] 여기도 동일하게 Unix 타임스탬프로 변환합니다.
        const fromTimestamp = Math.floor(
            new Date(`${from}T00:00:00.000Z`).getTime() / 1000
        );
        const toTimestamp = Math.floor(
            new Date(`${to}T23:59:59.999Z`).getTime() / 1000
        );

        if (isNaN(fromTimestamp) || isNaN(toTimestamp)) {
            throw new Error(`Invalid date format. From: ${from}, To: ${to}`);
        }

        const queryOptions = {
            period1: fromTimestamp,
            period2: toTimestamp,
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
