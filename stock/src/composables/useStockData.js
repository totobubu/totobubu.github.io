// stock/src/composables/useStockData.js
import { ref } from 'vue';
import { joinURL } from 'ufo';

// date parsing 함수도 이 파일로 가져옵니다.
const parseYYMMDD = (dateStr) => {
    if (!dateStr || typeof dateStr !== 'string') return null;
    const parts = dateStr.split('.').map(part => part.trim());
    if (parts.length !== 3) return null;
    return new Date(`20${parts[0]}`, parseInt(parts[1], 10) - 1, parts[2]);
};

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
            if (!response.ok) throw new Error(`File not found`);
            const responseData = await response.json();
            tickerInfo.value = responseData.tickerInfo;
            const sortedHistory = responseData.dividendHistory.sort((a, b) =>
                parseYYMMDD(b['배당락']) - parseYYMMDD(a['배당락'])
            );
            dividendHistory.value = sortedHistory;
        } catch (err) {
            error.value = `${tickerName.toUpperCase()}의 분배금 정보를 찾을 수 없습니다.`;
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
