// api/_utils/api-handler.js

export function createApiHandler(handler) {
    return async function (req, res) {
        // [핵심 수정] 허용 Origin 목록에 www가 없는 도메인을 추가합니다.
        const allowedOrigins = (
            process.env.ALLOWED_ORIGINS ||
            'http://localhost:5173,https://www.divgrow.com,https://divgrow.com'
        ).split(',');
        const origin = req.headers.origin;

        // Origin 헤더가 있고, 허용 목록에 포함된 경우 해당 Origin을 허용
        if (origin && allowedOrigins.includes(origin)) {
            res.setHeader('Access-Control-Allow-Origin', origin);
        }
        // Vercel 환경이 아니면서(로컬 개발 등) Origin 헤더가 없는 경우(Postman 등) '*'로 허용
        else if (!process.env.VERCEL && !origin) {
            res.setHeader('Access-Control-Allow-Origin', '*');
        }
        // 그 외의 경우는 CORS 헤더를 보내지 않음 (보안상 차단)

        res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
        res.setHeader(
            'Access-Control-Allow-Headers',
            'Content-Type, Authorization'
        );

        if (req.method === 'OPTIONS') {
            return res.status(200).end();
        }

        try {
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
