// stock/src/composables/useStockData.js
import { ref } from 'vue';
import { joinURL } from 'ufo';
import { parseYYMMDD } from '@/utils/date.js'; // 유틸리티 함수 import

export function useStockData() {
    const tickerInfo = ref(null);
    const dividendHistory = ref([]);
    const isLoading = ref(true);
    const error = ref(null);

    const fetchData = async (tickerName) => {
        isLoading.value = true;
        error.value = null;
        tickerInfo.value = null;
        dividendHistory.value = [];
        const url = joinURL(import.meta.env.BASE_URL, `data/${tickerName.toLowerCase()}.json`);

        try {
            const response = await fetch(url);

            // 404 에러를 더 명확하게 처리
            if (response.status === 404) {
                throw new Error(`Data file for ${tickerName.toUpperCase()} not found.`);
            }
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            // JSON 파싱 에러를 별도로 잡기 위해 try-catch 추가
            const responseData = await response.json();
            
            tickerInfo.value = responseData.tickerInfo;
            const sortedHistory = responseData.dividendHistory.sort((a, b) =>
                parseYYMMDD(b['배당락']) - parseYYMMDD(a['배당락'])
            );
            dividendHistory.value = sortedHistory;

        } catch (err) {
            // console.error(err); // 디버깅을 위해 콘솔에 실제 에러를 출력할 수 있습니다.
            if (err instanceof SyntaxError) {
                // JSON 파싱 실패 시
                error.value = `${tickerName.toUpperCase()}의 데이터 파일 형식이 올바르지 않습니다. (JSON 오류)`;
            } else {
                // 그 외 다른 모든 에러 (네트워크 문제, 파일 없음 등)
                error.value = `${tickerName.toUpperCase()}의 분배금 정보를 가져오는 데 실패했습니다.`;
            }
        } finally {
            isLoading.value = false;
        }
    };

    // 외부에서 사용할 수 있도록 상태와 함수를 반환합니다.
    return {
        tickerInfo,
        dividendHistory,
        isLoading,
        error,
        fetchData
    };
}
