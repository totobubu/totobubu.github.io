import { ref } from 'vue';
import { joinURL } from 'ufo';

const exchangeRates = ref([]);
let isLoaded = false;
let isLoadingPromise = null;

async function loadRates() {
    if (isLoaded) return;
    if (isLoadingPromise) return isLoadingPromise;

    isLoadingPromise = (async () => {
        try {
            const response = await fetch(
                joinURL(import.meta.env.BASE_URL, 'exchange-rates.json')
            );
            if (!response.ok)
                throw new Error('Failed to load exchange rates file');
            exchangeRates.value = await response.json();
            isLoaded = true;
        } catch (e) {
            console.error('Error loading exchange rates:', e);
        } finally {
            isLoadingPromise = null;
        }
    })();
    return isLoadingPromise;
}

export function useExchangeRates() {
    const findRateForDate = async (date) => {
        await loadRates();
        if (!date || isNaN(date.getTime()) || exchangeRates.value.length === 0)
            return null;

        let targetDate = new Date(date);
        for (let i = 0; i < 7; i++) {
            const dateStr = targetDate.toISOString().split('T')[0];
            const found = exchangeRates.value.find((r) => r.date === dateStr);
            if (found) return found.rate;
            targetDate.setDate(targetDate.getDate() + 1);
        }
        return null;
    };

    return { findRateForDate };
}
