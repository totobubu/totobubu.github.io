import yahooFinance from 'yahoo-finance2';

export default async function handler(req, res) {
    const { symbol, from, to } = req.query;
    if (!symbol || !from || !to) {
        return res
            .status(400)
            .json({ error: 'Symbol, from, and to parameters are required' });
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
            interval: '1d',
        };
        const result = await yahooFinance.historical(symbol, queryOptions);

        res.status(200).json({ symbol, data: result });
    } catch (error) {
        // 에러 발생 시, 원본 쿼리와 에러 메시지를 함께 반환하여 디버깅 용이하게 함
        res.status(200).json({
            symbol,
            data: [],
            error: `Failed for symbol ${symbol}: ${error.message}`,
            query: req.query, // 어떤 쿼리로 실패했는지 확인
        });
    }
}
