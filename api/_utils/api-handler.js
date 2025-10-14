// api/_utils/api-handler.js

/**
 * API 핸들러를 위한 고차 함수(Higher-Order Function).
 * CORS, OPTIONS 메서드 처리, 에러 핸들링 등 공통 로직을 처리합니다.
 * @param {function} handler - 실제 비즈니스 로직을 담고 있는 핸들러 함수.
 * @returns {function} - 최종적으로 Vercel에서 사용할 요청 핸들러.
 */
export function createApiHandler(handler) {
    return async function (req, res) {
        // 허용할 Origin 목록. 환경 변수에서 가져오거나 기본값을 사용합니다.
        const allowedOrigins = (
            process.env.ALLOWED_ORIGINS ||
            'http://localhost:5173,https://www.divgrow.com'
        ).split(',');
        const origin = req.headers.origin;

        if (origin && allowedOrigins.includes(origin)) {
            res.setHeader('Access-Control-Allow-Origin', origin);
        } else if (!origin && process.env.NODE_ENV !== 'production') {
            // 개발 환경에서 Postman 등 Origin 없는 요청 허용
            res.setHeader('Access-Control-Allow-Origin', '*');
        }

        res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
        res.setHeader(
            'Access-Control-Allow-Headers',
            'Content-Type, Authorization'
        );

        // Preflight 요청(OPTIONS) 처리
        if (req.method === 'OPTIONS') {
            return res.status(200).end();
        }

        try {
            // 실제 비즈니스 로직 실행
            await handler(req, res);
        } catch (error) {
            console.error(`[API Handler Error] Path: ${req.url}`, error);
            const errorMessage =
                error instanceof Error
                    ? error.message
                    : 'An unknown server error occurred';
            res.status(500).json({
                error: 'Internal Server Error',
                details: errorMessage,
            });
        }
    };
}
