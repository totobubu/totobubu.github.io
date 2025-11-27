import { ref } from 'vue';

const localStockData = ref(new Map());
const isLoaded = ref(false);
const isLoading = ref(false);

export function useLocalStockData() {
    const fetchAllStockData = async () => {
        if (isLoaded.value || isLoading.value) return;

        isLoading.value = true;
        const markets = ['KOSPI', 'KOSDAQ', 'NASDAQ', 'NYSE', 'AMEX'];
        const chars = [
            ...Array.from({ length: 10 }, (_, i) => i.toString()),
            ...Array.from({ length: 26 }, (_, i) =>
                String.fromCharCode(97 + i)
            ),
        ];

        const promises = [];
        for (const market of markets) {
            for (const char of chars) {
                promises.push(
                    fetch(`/nav/${market}/${char}.json`)
                        .then((res) => {
                            if (!res.ok) return [];
                            return res.json();
                        })
                        .then((data) => {
                            data.forEach((item) => {
                                if (item.isin) {
                                    // ISIN을 키로 저장 (중복 시 덮어쓰기 - 보통 동일함)
                                    localStockData.value.set(item.isin, item);
                                }
                            });
                        })
                        .catch(() => {
                            // 404 등 무시
                        })
                );
            }
        }

        await Promise.all(promises);
        isLoaded.value = true;
        isLoading.value = false;
    };

    const findStockByIsin = (isin) => {
        if (!isin) return null;
        return localStockData.value.get(isin);
    };

    return {
        localStockData,
        isLoaded,
        isLoading,
        fetchAllStockData,
        findStockByIsin,
    };
}
