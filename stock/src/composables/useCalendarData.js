// stock/src/composables/useCalendarData.js
import { ref, onMounted, computed } from "vue";

const STORAGE_KEY = "selectedCalendarTickers"; // localStorage 키를 상수로 관리

export function useCalendarData(selectedTickers) {
  const allTickers = ref([]);
  const groupedTickers = ref([]);
  const allDividendData = ref([]);
  const isLoading = ref(true);
  const error = ref(null);

  onMounted(async () => {
    try {
      const navResponse = await fetch("/nav.json");
      const navData = await navResponse.json();

      allTickers.value = navData.nav.map((item) => ({
        symbol: item.symbol,
        longName: item.longName || item.symbol,
        company: item.company || "기타",
      }));

      const groups = allTickers.value.reduce((acc, ticker) => {
        const company = ticker.company;
        if (!acc[company]) acc[company] = [];
        acc[company].push(ticker);
        return acc;
      }, {});

      groupedTickers.value = Object.keys(groups).map((company) => ({
        company: company,
        items: groups[company],
      }));

      // 👇 [핵심 수정 1] localStorage에서 저장된 값 불러오기
      const savedTickersJSON = localStorage.getItem(STORAGE_KEY);
      if (savedTickersJSON) {
        // 저장된 값이 있으면, 파싱해서 selectedTickers의 초기값으로 설정
        const savedSymbols = JSON.parse(savedTickersJSON);
        // allTickers에서 전체 정보를 찾아 복원
        selectedTickers.value = allTickers.value.filter((t) =>
          savedSymbols.includes(t.symbol)
        );
      } else if (allTickers.value.length > 0) {
        // 저장된 값이 없으면, 기존처럼 상위 8개를 기본값으로 설정
        selectedTickers.value = allTickers.value.slice(0, 8);
      }

      const tickerNames = allTickers.value.map((t) => t.symbol).filter(Boolean);
      const tickerDataPromises = tickerNames.map(async (ticker) => {
        if (!ticker) return null;
        try {
          const response = await fetch(`/data/${ticker.toLowerCase()}.json`);
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
            if (dividend && dividend.배당락 && dividend.배당금) {
              try {
                const parts = dividend.배당락.split(".").map((p) => p.trim());
                const dateStr = `20${parts[0]}-${parts[1].padStart(2, "0")}-${parts[2].padStart(2, "0")}`;
                const amount = parseFloat(dividend.배당금.replace("$", ""));
                if (!isNaN(amount)) {
                  flatDividendList.push({
                    date: dateStr,
                    amount,
                    ticker: tickerName.toUpperCase(),
                  });
                }
              } catch (e) {}
            }
          });
        }
      });
      allDividendData.value = flatDividendList;
    } catch (err) {
      console.error("데이터 로딩 중 심각한 오류 발생:", err);
      error.value = "데이터를 불러오지 못했습니다.";
    } finally {
      isLoading.value = false;
    }
  });

  const dividendsByDate = computed(() => {
    if (!Array.isArray(selectedTickers.value)) return {};
    const masterData = allDividendData.value;
    const selectedSymbols = selectedTickers.value
      .filter((t) => t && t.symbol)
      .map((t) => t.symbol.toUpperCase());

    if (masterData.length === 0 || selectedSymbols.length === 0) return {};

    const filteredDividends = masterData.filter((div) =>
      selectedSymbols.includes(div.ticker)
    );
    const processed = {};
    filteredDividends.forEach((div) => {
      if (!processed[div.date]) {
        processed[div.date] = { entries: [] };
      }
      processed[div.date].entries.push({
        ticker: div.ticker,
        amount: div.amount,
      });
    });
    return processed;
  });

  return { allTickers, groupedTickers, dividendsByDate, isLoading, error };
}
