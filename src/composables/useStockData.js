import { ref } from 'vue';
import { joinURL } from 'ufo';

// --- 핵심: 모든 상태를 함수 밖으로 빼서 전역 변수로 만듭니다 ---
const tickerInfo = ref(null);
const dividendHistory = ref([]);
const isLoading = ref(false); // 초기값을 false로
const error = ref(null);

// -----------------------------------------------------------------

export function useStockData() {
    // 이제 이 함수는 전역 상태와 그 상태를 변경하는 함수만 반환합니다.

    const loadData = async (tickerSymbol) => {
        if (!tickerSymbol) {
            error.value = '티커 정보가 없습니다.';
            return;
        }
        // 이전에 로딩 중이던 데이터와 충돌하지 않도록 초기화
        isLoading.value = true;
        error.value = null;
        tickerInfo.value = null;
        dividendHistory.value = [];

        try {
            const [liveDataResponse, staticDataResponse] = await Promise.all([
                fetch(
                    `/api/getStockData?tickers=${tickerSymbol.toUpperCase()}`
                ),
                fetch(
                    joinURL(
                        import.meta.env.BASE_URL,
                        `data/${tickerSymbol.toLowerCase()}.json`
                    )
                ),
            ]);

            if (!liveDataResponse.ok || !staticDataResponse.ok) {
                // 특정 종목의 static data가 없는 것은 흔한 일이므로 에러를 던지지 않음
                console.warn(
                    `정적 데이터 파일을 찾을 수 없습니다: ${tickerSymbol}.json`
                );
            }

            const liveDataArray = await liveDataResponse.json();

            // staticDataResponse가 실패했을 경우를 대비
            const staticData = staticDataResponse.ok
                ? await staticDataResponse.json()
                : {};

            if (!liveDataArray || liveDataArray.length === 0) {
                throw new Error('Live data not found for the ticker');
            }
            const liveData = liveDataArray[0];

            tickerInfo.value = {
                ...(staticData.tickerInfo || {}),
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

    return { tickerInfo, dividendHistory, isLoading, error, loadData };
}
