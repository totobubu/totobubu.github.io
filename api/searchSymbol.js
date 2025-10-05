// REFACTORED: api/searchSymbol.js

import axios from 'axios';

const YF_SEARCH_URL = 'https://query1.finance.yahoo.com/v1/finance/search';
const YF_HEADERS = {
    'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
};

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    const { query, country } = req.query; // country 파라미터 받기
    if (!query) {
        return res.status(400).json({ error: 'Query parameter is required' });
    }

    try {
        const { data } = await axios.get(YF_SEARCH_URL, {
            headers: YF_HEADERS,
            params: {
                q: query,
                quotesCount: 20, // 더 많은 결과를 가져와서 필터링할 수 있도록 개수 늘리기
                newsCount: 0,
            },
        });

        if (!data.quotes || data.quotes.length === 0) {
            return res.status(200).json([]);
        }

        let filteredQuotes = data.quotes.filter(
            (q) => q.symbol && !q.symbol.includes('=')
        ); // 환율 등 제외

        // --- [핵심 추가] 국가별 필터링 로직 ---
        if (country === 'KR') {
            filteredQuotes = filteredQuotes.filter(
                (q) => q.symbol.endsWith('.KS') || q.symbol.endsWith('.KQ')
            );
        } else if (country === 'US') {
            // .KS, .KQ가 아닌 것들 중 미국 거래소에 상장된 것 위주로 필터링
            const usExchanges = ['NMS', 'NYQ', 'PCX', 'OPR'];
            filteredQuotes = filteredQuotes.filter(
                (q) =>
                    !q.symbol.endsWith('.KS') &&
                    !q.symbol.endsWith('.KQ') &&
                    usExchanges.includes(q.exchange)
            );
        }
        // country 파라미터가 없으면 필터링 없이 진행
        // --- // ---

        const suggestions = filteredQuotes
            .slice(0, 7) // 최종 결과는 7개로 제한
            .map((q) => ({
                symbol: q.symbol,
                name: q.longname || q.shortname,
                market: q.exchDisp,
            }));

        res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate');
        return res.status(200).json(suggestions);
    } catch (error) {
        console.error(
            '[API/searchSymbol] Error fetching from Yahoo Search API:',
            error
        );
        return res
            .status(500)
            .json({
                error: 'Failed to fetch search results from Yahoo Finance',
            });
    }
}
