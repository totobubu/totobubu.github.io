import { ref, computed } from 'vue';
import { joinURL } from 'ufo';
import { useFilterState } from './useFilterState';

// Composable 함수 밖에서 상태를 관리하여 싱글턴처럼 작동하도록 합니다.
const allDividendData = ref([]);
const isLoading = ref(true);
const error = ref(null);

// "내 종목" 목록. 이상적으로는 이것도 별도의 스토어에서 관리해야 합니다.
const myStockSymbols = ref(['YMAX', 'YMAG', 'QDTE']); // AppSidebar.vue와 동일하게 유지

// 데이터 로딩은 한 번만 실행되도록
let isDataLoaded = false;

const loadAllData = async () => {
    // 이미 로드했다면 다시 실행하지 않음
    if (isDataLoaded) return;

    isLoading.value = true;
    error.value = null;

    try {
        // 모든 티커의 배당 정보를 가져옵니다.
        const tickerNamesResponse = await fetch(
            joinURL(import.meta.env.BASE_URL, 'nav.json')
        );
        const tickerNavData = await tickerNamesResponse.json();
        const tickerInfoMap = new Map(
            tickerNavData.nav.map((item) => [item.symbol, item])
        );
        const tickerNames = tickerNavData.nav
            .map((t) => t.symbol)
            .filter(Boolean);

        const tickerDataPromises = tickerNames.map(async (ticker) => {
            try {
                const response = await fetch(
                    joinURL(
                        import.meta.env.BASE_URL,
                        `data/${ticker.toLowerCase()}.json`
                    )
                );
                if (!response.ok) return null;
                return { tickerName: ticker, data: await response.json() };
            } catch (e) {
                return null;
            }
        });

        const allDataWithNames = (await Promise.all(tickerDataPromises)).filter(
            Boolean
        );

        const flatDividendList = [];
        allDataWithNames.forEach(({ tickerName, data }) => {
            if (data.dividendHistory && Array.isArray(data.dividendHistory)) {
                data.dividendHistory.forEach((dividend) => {
                    if (dividend && dividend.배당락) {
                        try {
                            const parts = dividend.배당락
                                .split('.')
                                .map((p) => p.trim());
                            const dateStr = `20${parts[0]}-${parts[1].padStart(2, '0')}-${parts[2].padStart(2, '0')}`;
                            const amount = dividend.배당금
                                ? parseFloat(dividend.배당금.replace('$', ''))
                                : null;
                            const tickerInfo = tickerInfoMap.get(
                                tickerName.toUpperCase()
                            ); // Map에서 정보 조회
                            flatDividendList.push({
                                date: dateStr,
                                amount,
                                ticker: tickerName.toUpperCase(),
                                // 추가 정보 주입
                                frequency: tickerInfo?.frequency,
                                group: tickerInfo?.group,
                            });
                        } catch (e) {
                            // 날짜 파싱 오류는 무시
                        }
                    }
                });
            }
        });

        allDividendData.value = flatDividendList;
        isDataLoaded = true; // 로딩 완료 플래그 설정
        console.log('달력 데이터 로딩 완료.');
    } catch (err) {
        console.error('데이터 로딩 중 오류 발생:', err);
        error.value = '달력 데이터를 불러오지 못했습니다.';
    } finally {
        isLoading.value = false;
    }
};

export function useCalendarData() {
    // 이제 myStockSymbols도 전역 스토어에서 가져옵니다.
    const { showMyStocksOnly, myStockSymbols } = useFilterState();

    // 달력에 표시될 데이터를 계산하는 computed 속성
    const dividendsByDate = computed(() => {
        let sourceData = allDividendData.value;

        // "내 종목만 보기"가 활성화된 경우, 데이터 소스를 필터링합니다.
        if (showMyStocksOnly.value) {
            sourceData = allDividendData.value.filter((div) =>
                myStockSymbols.value.includes(div.ticker)
            );
        }

        // 날짜별로 그룹화합니다.
        const grouped = {};
        sourceData.forEach((div) => {
            if (!grouped[div.date]) {
                grouped[div.date] = [];
            }
            grouped[div.date].push(div);
        });

        return grouped;
    });

    return {
        dividendsByDate, // 달력 컴포넌트에서 사용할 최종 데이터
        isLoading,
        error,
        loadAllData, // Layout에서 호출할 함수
    };
}
