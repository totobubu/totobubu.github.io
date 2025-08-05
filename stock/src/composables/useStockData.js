import { ref } from 'vue';
import { joinURL } from 'ufo';
import { parseYYMMDD } from '@/utils/date.js';

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
            if (response.status === 404)
                throw new Error(
                    `Data for ${tickerName.toUpperCase()} not found.`
                );
            if (!response.ok)
                throw new Error(`HTTP error! status: ${response.status}`);

            const responseData = await response.json();
            tickerInfo.value = responseData.tickerInfo;
            dividendHistory.value = responseData.dividendHistory.sort(
                (a, b) => parseYYMMDD(b['배당락']) - parseYYMMDD(a['배당락'])
            );
        } catch (err) {
            error.value = `Failed to fetch data for ${tickerName.toUpperCase()}.`;
        } finally {
            isLoading.value = false;
        }
    };

    return { tickerInfo, dividendHistory, isLoading, error, fetchData };
}
