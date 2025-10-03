// REFACTORED: api/getStockData.js

import yahooFinance from 'yahoo-finance2';

// --- [신규] NaN 값을 null로 변환하는 재귀 함수 ---
// 데이터 내부에 중첩된 객체나 배열이 있을 수 있으므로 재귀적으로 처리하는 것이 가장 안전합니다.
function sanitizeForJSON(data) {
    if (data === null || typeof data !== 'object') {
        // 값이 숫자이고 NaN일 경우 null로 변환
        if (typeof data === 'number' && isNaN(data)) {
            return null;
        }
        return data;
    }

    // 배열인 경우, 각 항목에 대해 재귀적으로 함수 호출
    if (Array.isArray(data)) {
        return data.map(sanitizeForJSON);
    }

    // 객체인 경우, 각 속성 값에 대해 재귀적으로 함수 호출
    const newObj = {};
    for (const key of Object.keys(data)) {
        newObj[key] = sanitizeForJSON(data[key]);
    }
    return newObj;
}
// --- // ---


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

        // --- [수정] 결과를 클라이언트에 보내기 전에 데이터 정제 ---
        const sanitizedResults = sanitizeForJSON(results);
        return response.status(200).json(sanitizedResults);
        // --- // ---

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
