import { ref } from 'vue';
import { joinURL } from 'ufo';

// 이제 이 Composable은 ticker를 인자로 받지 않습니다.
export function useStockData() {
    const tickerInfo = ref(null);
    const dividendHistory = ref([]);
    const isLoading = ref(true);
    const error = ref(null);

    // loadData 함수는 외부에서 호출할 수 있도록 return 합니다.
    const loadData = async (tickerSymbol) => {
        if (!tickerSymbol) {
            error.value = '티커 정보가 없습니다.';
            isLoading.value = false;
            return;
        }
        isLoading.value = true;
        error.value = null;
        tickerInfo.value = null; // 이전 데이터 초기화
        dividendHistory.value = [];

        try {
            const [liveDataResponse, staticDataResponse] = await Promise.all([
                fetch(`/api/getStockData?tickers=${tickerSymbol.toUpperCase()}`),
                fetch(joinURL(import.meta.env.BASE_URL, `data/${tickerSymbol.toLowerCase()}.json`))
            ]);

            // 하나의 요청이라도 실패하면 에러로 간주 (더 안정적인 처리)
            if (!liveDataResponse.ok || !staticDataResponse.ok) {
                 throw new Error('Failed to fetch stock data');
            }
            
            const liveDataArray = await liveDataResponse.json();
            const staticData = await staticDataResponse.json();

            if (!liveDataArray || liveDataArray.length === 0) {
                throw new Error('Live data not found for the ticker');
            }
            const liveData = liveDataArray[0];

            tickerInfo.value = {
                ...staticData.tickerInfo,
                ...liveData,
            };
            dividendHistory.value = staticData.dividendHistory || [];

        } catch (err) {
            console.error(`Failed to load data for ${tickerSymbol}:`, err);
            error.value = `${tickerSymbol.toUpperCase()}의 데이터를 불러오는 데 실패했습니다.`;
        } finally {
            isLoading.value = false;
        }
    };

    // watch 로직을 여기서 완전히 제거합니다.

    // loadData 함수를 반환하여 StockView에서 사용할 수 있게 합니다.
    return { tickerInfo, dividendHistory, isLoading, error, loadData };
}