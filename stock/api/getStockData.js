export default async function handler(request, response) {
    // 1. 클라이언트가 보낸 tickers 쿼리 파라미터를 가져옵니다.
    // 예: /api/getStockData?tickers=AAPL,MSFT
    const tickers = request.query.tickers;

    if (!tickers) {
        // tickers가 없으면 400 에러를 반환합니다.
        return response.status(400).json({ error: 'Tickers query parameter is required' });
    }

    // 2. 야후 파이낸스 API에 요청을 보냅니다.
    try {
        const yahooResponse = await fetch(`https://query1.finance.yahoo.com/v7/finance/quote?symbols=${tickers}`);
        
        if (!yahooResponse.ok) {
            // 야후 파이낸스에서 에러가 발생한 경우
            throw new Error(`Yahoo Finance API failed with status ${yahooResponse.status}`);
        }
        
        const data = await yahooResponse.json();
        
        // 3. 필요한 데이터만 추출하여 가공합니다.
        const results = data.quoteResponse.result.map(stock => ({
            symbol: stock.symbol,
            longName: stock.longName || stock.shortName,
            regularMarketPrice: stock.regularMarketPrice,
            regularMarketChange: stock.regularMarketChange,
            regularMarketChangePercent: stock.regularMarketChangePercent,
            currency: stock.currency,
            // 필요에 따라 다른 데이터도 추가할 수 있습니다.
            // 예: fiftyTwoWeekRange: stock.fiftyTwoWeekRange
        }));

        // 4. 클라이언트에게 성공적으로 데이터를 전송합니다.
        // Vercel의 서버리스 환경에서는 CORS 설정이 자동으로 처리되는 경우가 많습니다.
        // 캐시 제어 헤더를 추가하여 데이터가 5분 동안 캐시되도록 설정 (API 요청 줄이기)
        response.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate');
        return response.status(200).json(results);

    } catch (error) {
        console.error(error);
        return response.status(500).json({ error: 'Failed to fetch data from Yahoo Finance' });
    }
}