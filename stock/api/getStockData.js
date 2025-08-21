// CJS 방식: require 사용
const yahooFinance = require('yahoo-finance2').default;

// CJS 방식: module.exports 사용
module.exports = async (request, response) => {
    // CORS 헤더 설정
    const allowedOrigins = [
        'http://localhost:5173',
        'https://www.divgrow.com',
        'https://divgrow.com',
    ];
    const origin = request.headers.origin;

    if (origin && allowedOrigins.includes(origin)) {
        response.setHeader('Access-Control-Allow-Origin', origin);
    }

    response.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    response.setHeader(
        'Access-Control-Allow-Headers',
        'Content-Type, Authorization'
    );

    if (request.method === 'OPTIONS') {
        return response.status(200).end();
    }

    const tickers = request.query.tickers;

    if (!tickers) {
        return response
            .status(400)
            .json({ error: 'Tickers query parameter is required' });
    }

    try {
        // yahooFinance.quote 함수를 사용하여 여러 티커를 한 번에 조회
        const results = await yahooFinance.quote(tickers.split(','));

        // 필요한 데이터만 추출하여 가공 (라이브러리가 반환하는 필드 이름이 약간 다를 수 있음)
        const formattedResults = results.map((stock) => ({
            symbol: stock.symbol,
            longName: stock.longName || stock.shortName,
            regularMarketPrice: stock.regularMarketPrice,
            regularMarketChange: stock.regularMarketChange,
            regularMarketChangePercent: stock.regularMarketChangePercent,
            currency: stock.currency,
        }));

        response.setHeader(
            'Cache-Control',
            's-maxage=300, stale-while-revalidate'
        );
        return response.status(200).json(formattedResults);
    } catch (error) {
        console.error('Yahoo Finance fetch error:', error);
        // 라이브러리가 던지는 에러를 더 자세히 보여줄 수 있음
        return response.status(500).json({
            error: 'Failed to fetch data from Yahoo Finance',
            details: error.message,
        });
    }
};
