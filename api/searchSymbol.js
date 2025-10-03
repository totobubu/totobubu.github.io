// NEW FILE: api/searchSymbol.js

import axios from 'axios';

const YF_SEARCH_URL = 'https://query1.finance.yahoo.com/v1/finance/search';
const YF_HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
};

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    const { query } = req.query;
    if (!query) {
        return res.status(400).json({ error: 'Query parameter is required' });
    }

    try {
        const { data } = await axios.get(YF_SEARCH_URL, {
            headers: YF_HEADERS,
            params: {
                q: query,
                quotesCount: 6, // 가져올 추천 개수
                newsCount: 0,
            },
        });

        if (!data.quotes || data.quotes.length === 0) {
            return res.status(200).json([]);
        }

        // 클라이언트 AutoComplete에 맞게 데이터 형식 가공
        const suggestions = data.quotes
            .filter(q => q.symbol && !q.symbol.includes('=')) // 환율 같은 불필요한 항목 제외
            .map(q => ({
                symbol: q.symbol,
                name: q.longname || q.shortname,
                market: q.exchDisp,
            }));

        res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate');
        return res.status(200).json(suggestions);

    } catch (error) {
        console.error('[API/searchSymbol] Error fetching from Yahoo Search API:', error);
        return res.status(500).json({ error: 'Failed to fetch search results from Yahoo Finance' });
    }
}
