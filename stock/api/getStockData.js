import yahooFinance from 'yahoo-finance2';

export default async function handler(request, response) {
    // --- 핵심: CORS 헤더 설정 추가 ---
    // 개발 환경(localhost)에서의 요청을 허용합니다.
    const allowedOrigin = process.env.ALLOWED_ORIGIN || '*';

    response.setHeader('Access-Control-Allow-Origin', allowedOrigin);
    response.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    response.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    // 브라우저가 보내는 사전 요청(preflight request)인 OPTIONS 요청에 대한 처리
    if (request.method === 'OPTIONS') {
        return response.status(200).end();
    }
    // ------------------------------------

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
}
