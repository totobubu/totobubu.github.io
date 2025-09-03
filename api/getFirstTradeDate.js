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
            throw new Error('Could not find first trade date for the symbol.');
        }
        const date = new Date(firstTradeDate);
        res.status(200).json({ symbol, firstTradeDate: date.toISOString().split('T')[0] });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
}
