import { ref, computed, watch } from "vue";
import { joinURL } from "ufo";

const STORAGE_KEY = "selectedCalendarTickers";

const allTickers = ref([]);
const groupedTickers = ref([]);
const allDividendData = ref([]);
const isLoading = ref(true);
const error = ref(null);
const selectedTickers = ref([]);

watch(selectedTickers, (newSelection) => {
    if (newSelection) {
        const symbolsToSave = newSelection.map(ticker => ticker.symbol);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(symbolsToSave));
    }
}, { deep: true });

const dividendsByDate = computed(() => {
    if (!Array.isArray(selectedTickers.value)) return {};
    
    const masterData = allDividendData.value;
    const selectedSymbols = selectedTickers.value
        .filter((t) => t && t.symbol)
        .map((t) => t.symbol.toUpperCase());
        
    if (masterData.length === 0 || selectedSymbols.length === 0) return {};

    const filteredDividends = masterData.filter((div) => selectedSymbols.includes(div.ticker));
    
    const groupedByDate = {};
    filteredDividends.forEach((div) => {
        if (!groupedByDate[div.date]) {
            groupedByDate[div.date] = [];
        }
        groupedByDate[div.date].push(div);
    });

    const processed = {};
    for (const date in groupedByDate) {
        const entriesForDay = groupedByDate[date];
        const uniqueEntries = new Map();

        entriesForDay.forEach((entry) => {
            const existing = uniqueEntries.get(entry.ticker);
            if (!existing || (entry.amount !== null && existing.amount === null)) {
                uniqueEntries.set(entry.ticker, { 
                    ticker: entry.ticker, 
                    amount: entry.amount 
                });
            }
        });

        if (uniqueEntries.size > 0) {
            processed[date] = { entries: Array.from(uniqueEntries.values()) };
        }
    }
    
    return processed;
});

const loadAllData = async () => {
    isLoading.value = true;
    error.value = null;
    try {
        const navResponse = await fetch(joinURL(import.meta.env.BASE_URL, "nav.json"));
        const navData = await navResponse.json();

        allTickers.value = navData.nav.map((item) => ({
            symbol: item.symbol,
            longName: item.longName || item.symbol,
            company: item.company || "기타",
            frequency: item.frequency,
            group: item.group
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

        const savedTickersJSON = localStorage.getItem(STORAGE_KEY);
        if (savedTickersJSON) {
            const savedSymbols = JSON.parse(savedTickersJSON);
            selectedTickers.value = allTickers.value.filter((t) =>
                savedSymbols.includes(t.symbol)
            );
        } else if (allTickers.value.length > 0) {
            // selectedTickers.value = allTickers.value.slice(0, 8);
            selectedTickers.value = [...allTickers.value];
        }

        const tickerNames = allTickers.value.map((t) => t.symbol).filter(Boolean);
        const tickerDataPromises = tickerNames.map(async (ticker) => {
            if (!ticker) return null;
            try {
                const response = await fetch(joinURL(import.meta.env.BASE_URL, `data/${ticker.toLowerCase()}.json`));
                if (!response.ok) return null;
                return { tickerName: ticker, data: await response.json() };
            } catch (e) { return null; }
        });

        const allDataWithNames = (await Promise.all(tickerDataPromises)).filter(Boolean);
        
        const flatDividendList = [];
        allDataWithNames.forEach(({ tickerName, data }) => {
            if (data.dividendHistory && Array.isArray(data.dividendHistory)) {
                data.dividendHistory.forEach((dividend) => {
                    if (dividend && dividend.배당락) { 
                        try {
                            const parts = dividend.배당락.split(".").map((p) => p.trim());
                            const dateStr = `20${parts[0]}-${parts[1].padStart(2, "0")}-${parts[2].padStart(2, "0")}`;
                            const amount = dividend.배당금 ? parseFloat(dividend.배당금.replace("$", "")) : null;
                            if (amount === null || !isNaN(amount)) {
                                flatDividendList.push({
                                    date: dateStr,
                                    amount: amount,
                                    ticker: tickerName.toUpperCase()
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
};

const removeTicker = (tickerSymbol) => {
    selectedTickers.value = selectedTickers.value.filter(
        (ticker) => ticker.symbol !== tickerSymbol
    );
};

export function useCalendarData() {
    return { 
        allTickers, 
        groupedTickers, 
        dividendsByDate, 
        isLoading, 
        error, 
        selectedTickers,
        loadAllData,
        removeTicker 
    };
}