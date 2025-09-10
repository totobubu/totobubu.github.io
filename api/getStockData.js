// api\getStockData.js
import yahooFinance from 'yahoo-finance2';

export default async function handler(request, response) {
    const allowedOrigins = [
        'http://localhost:5173',
        'http://localhost:3000',
        'https://www.divgrow.com',
        'https://divgrow.com',
    ];
    const origin = request.headers.origin;

    if (origin && allowedOrigins.includes(origin)) {
        response.setHeader('Access-Control-Allow-Origin', origin);
    }

    response.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    response.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (request.method === 'OPTIONS') {
        return response.status(200).end();
    }

    const tickers = request.query.tickers;
    if (!tickers) {
        return response
            .status(400)
            .json({ error: 'Tickers parameter is required' });
    }

    try {
        const results = await yahooFinance.quote(tickers.split(','));
        return response.status(200).json(results);
    } catch (error) {
        console.error('Yahoo Finance API Error:', error);
        const errorMessage =
            error instanceof Error
                ? error.message
                : 'An unknown error occurred';
        return response.status(500).json({
            error: 'Failed to fetch data from Yahoo Finance',
            details: errorMessage,
        });
    }
}
