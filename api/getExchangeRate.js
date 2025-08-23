// api\getExchangeRate.js
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

    // 환율을 조회할 티커. 'USDKRW=X'는 USD/KRW 환율을 의미합니다.
    const ticker = 'USDKRW=X';

    try {
        // yahoo-finance2는 quote()가 아닌 다른 메서드를 사용할 수 있습니다.
        // 또는 quote()가 객체 대신 배열을 반환할 수 있습니다.
        const result = await yahooFinance.quote(ticker);

        if (!result || !result.regularMarketPrice) {
            // 디버깅을 위해 받은 데이터 전체를 출력
            console.error(
                'Unexpected Yahoo Finance response for exchange rate:',
                result
            );
            throw new Error('Exchange rate data not found in response');
        }

        // 필요한 데이터만 추출하여 응답 객체 생성
        const exchangeRateData = {
            symbol: result.symbol,
            price: result.regularMarketPrice,
            change: result.regularMarketChange,
            changePercent: result.regularMarketChangePercent,
        };

        // 데이터를 10분 동안 캐시하도록 설정 (API 요청 줄이기)
        response.setHeader(
            'Cache-Control',
            's-maxage=600, stale-while-revalidate'
        );

        // 성공적으로 JSON 데이터 응답
        return response.status(200).json(exchangeRateData);
    } catch (error) {
        console.error('Yahoo Finance exchange rate fetch error:', error);

        // 에러 발생 시 500 상태 코드와 에러 메시지 응답
        return response.status(500).json({
            error: 'Failed to fetch exchange rate data',
            details: error.message,
        });
    }
};
