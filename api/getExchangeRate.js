// api\getExchangeRate.js
import yahooFinance from 'yahoo-finance2';
import { createApiHandler } from './_utils/api-handler';

async function getExchangeRateHandler(req, res) {
    const ticker = 'USDKRW=X';
    const result = await yahooFinance.quote(ticker);

    if (!result || !result.regularMarketPrice) {
        console.error(
            'Unexpected Yahoo Finance response for exchange rate:',
            result
        );
        throw new Error('Exchange rate data not found in response');
    }

    const exchangeRateData = {
        symbol: result.symbol,
        price: result.regularMarketPrice,
        change: result.regularMarketChange,
        changePercent: result.regularMarketChangePercent,
    };

    res.setHeader('Cache-Control', 's-maxage=600, stale-while-revalidate');
    return res.status(200).json(exchangeRateData);
}

export default createApiHandler(getExchangeRateHandler);
