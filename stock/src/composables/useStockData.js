import { ref, watch } from 'vue';
import { joinURL } from 'ufo';

export function useStockData(ticker) {
    const tickerInfo = ref(null);
    const dividendHistory = ref([]);
    const isLoading = ref(true);
    const error = ref(null);

    const loadData = async (tickerSymbol) => {
        if (!tickerSymbol) return;
        isLoading.value = true;
        error.value = null;
        try {
            // 두 개의 데이터를 병렬로 요청합니다.
            const [liveDataResponse, staticDataResponse] = await Promise.all([
                // 1. 실시간 시세 정보는 우리 API를 통해 가져옵니다.
                fetch(
                    `/api/getStockData?tickers=${tickerSymbol.toUpperCase()}`
                ),
                // 2. 배당 내역 등 정적 정보는 기존 JSON 파일에서 가져옵니다.
                fetch(
                    joinURL(
                        import.meta.env.BASE_URL,
                        `data/${tickerSymbol.toLowerCase()}.json`
                    )
                ),
            ]);

            if (!liveDataResponse.ok)
                throw new Error('Failed to fetch live stock data');
            if (!staticDataResponse.ok)
                throw new Error('Failed to fetch static stock data');

            const liveDataArray = await liveDataResponse.json();
            const staticData = await staticDataResponse.json();

            // API는 배열을 반환하므로, 첫 번째 요소를 사용합니다.
            const liveData = liveDataArray[0];

            // 3. 두 데이터를 합쳐서 tickerInfo ref를 업데이트합니다.
            tickerInfo.value = {
                ...staticData.tickerInfo, // Yield, company, group 등
                ...liveData, // symbol, longName, regularMarketPrice 등 실시간 정보로 덮어쓰기
            };

            dividendHistory.value = staticData.dividendHistory || [];
        } catch (err) {
            console.error(`Failed to load data for ${tickerSymbol}:`, err);
            error.value = `${tickerSymbol.toUpperCase()}의 데이터를 불러오는 데 실패했습니다.`;
        } finally {
            isLoading.value = false;
        }
    };

    watch(
        () => ticker,
        (newTicker) => {
            loadData(newTicker);
        },
        { immediate: true }
    ); // 컴포넌트 생성 시 즉시 실행

    return { tickerInfo, dividendHistory, isLoading, error };
}
