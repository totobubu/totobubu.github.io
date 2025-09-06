import yahooFinance from 'yahoo-finance2';

export default async function handler(req, res) {
    const { symbol, from, to } = req.query;
    if (!symbol || !from || !to) {
        return res
            .status(400)
            .json({ error: 'Symbol, from, and to parameters are required' });
    }

    try {
        // [핵심 수정] 날짜 문자열을 UTC 자정 기준으로 Date 객체로 만든 후, Unix 타임스탬프(초)로 변환합니다.
        const fromTimestamp = Math.floor(
            new Date(`${from}T00:00:00.000Z`).getTime() / 1000
        );
        const toTimestamp = Math.floor(
            new Date(`${to}T23:59:59.999Z`).getTime() / 1000
        );

        // 유효성 검사
        if (isNaN(fromTimestamp) || isNaN(toTimestamp)) {
            throw new Error(`Invalid date format. From: ${from}, To: ${to}`);
        }

        const queryOptions = {
            period1: fromTimestamp, // 숫자(타임스탬프) 전달
            period2: toTimestamp, // 숫자(타임스탬프) 전달
            interval: '1d',
        };
        const result = await yahooFinance.historical(symbol, queryOptions);

        res.status(200).json({ symbol, data: result });
    } catch (error) {
        res.status(200).json({
            symbol,
            data: [],
            error: `Failed for symbol ${symbol}: ${error.message}`,
            query: req.query,
        });
    }
}
