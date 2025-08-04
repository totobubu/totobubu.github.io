// composables/useStockData.js

import { ref } from 'vue';
import { joinURL } from 'ufo';
import { parseYYMMDD } from '@/utils/date.js';

// [핵심 1] 모든 상태를 함수 밖으로 빼서 공유(싱글톤) 상태로 만듭니다.
const tickerInfo = ref(null);
const dividendHistory = ref([]);
const isLoading = ref(true);
const error = ref(null);

export function useStockData() {
    const fetchData = async (tickerName) => {
        isLoading.value = true;
        error.value = null;
        tickerInfo.value = null;
        dividendHistory.value = [];
        const url = joinURL(
            import.meta.env.BASE_URL,
            `data/${tickerName.toLowerCase()}.json`
        );

        try {
            const response = await fetch(url);
            if (response.status === 404) {
                throw new Error(
                    `Data file for ${tickerName.toUpperCase()} not found.`
                );
            }
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const responseData = await response.json();

            // [핵심 2] 이제 이 함수는 공유 상태를 업데이트하는 역할만 합니다.
            tickerInfo.value = responseData.tickerInfo;
            const sortedHistory = responseData.dividendHistory.sort(
                (a, b) => parseYYMMDD(b['배당락']) - parseYYMMDD(a['배당락'])
            );
            dividendHistory.value = sortedHistory;
        } catch (err) {
            if (err instanceof SyntaxError) {
                error.value = `${tickerName.toUpperCase()}의 데이터 파일 형식이 올바르지 않습니다. (JSON 오류)`;
            } else {
                error.value = `${tickerName.toUpperCase()}의 분배금 정보를 가져오는 데 실패했습니다.`;
            }
        } finally {
            isLoading.value = false;
        }
    };

    // [핵심 3] 모든 컴포넌트가 동일한 공유 상태와 함수를 바라보도록 반환합니다.
    return {
        tickerInfo,
        dividendHistory,
        isLoading,
        error,
        fetchData,
    };
}
