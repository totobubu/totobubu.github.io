import yahooFinance from 'yahoo-finance2';

export default async function handler(req, res) {
    const { symbol } = req.query;
    if (!symbol) {
        return res.status(400).json({ error: 'Symbol parameter is required' });
    }
    try {
        const quote = await yahooFinance.quote(symbol);
        const firstTradeDate = quote.firstTradeDateMilliseconds;

        if (!firstTradeDate) {
            // 데이터는 있으나 상장일 정보가 없는 경우
            return res.status(200).json({ symbol, firstTradeDate: null, error: 'First trade date not available.' });
        }
        
        const date = new Date(firstTradeDate);
        res.status(200).json({ symbol, firstTradeDate: date.toISOString().split('T')[0] });

    } catch (error) {
        // 라이브러리 자체가 에러를 던지는 경우 (예: 존재하지 않는 티커, 신규 상장 예정)
        // 500 에러 대신, 실패 정보를 담은 200 성공 응답을 보냅니다.
        res.status(200).json({ symbol, firstTradeDate: null, error: error.message });
    }
}
