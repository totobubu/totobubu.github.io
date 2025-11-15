// src/store/instruments.js

import { reactive } from 'vue';
import { getDataUrl } from '@/utils/dataUrl';

const normalizeSymbol = (symbol) =>
    typeof symbol === 'string' ? symbol.trim().toUpperCase() : null;
const normalizeIsin = (isin) =>
    typeof isin === 'string' ? isin.trim().toUpperCase() : null;

const state = reactive({
    bySymbol: {},
    byIsin: {},
    hasNavSnapshot: false,
});

let navLoadPromise = null;

const loadSymbolIsinSnapshot = async () => {
    try {
        const response = await fetch(getDataUrl('symbol-to-isin.json'));
        if (!response.ok) return;
        const snapshot = await response.json();
        if (Array.isArray(snapshot)) {
            registerInstruments(snapshot);
        } else if (snapshot && typeof snapshot === 'object') {
            const entries = Object.entries(snapshot).map(([symbol, value]) => {
                if (typeof value === 'string') {
                    return { symbol, isin: value };
                }
                return {
                    symbol,
                    isin: value?.isin,
                    market: value?.market,
                    currency: value?.currency,
                };
            });
            registerInstruments(entries);
        }
    } catch (error) {
        console.warn(
            '[InstrumentDirectory] symbol-to-isin.json 로드 실패:',
            error
        );
    }
};

const mergeInstrument = (existing = {}, incoming = {}) => {
    const merged = { ...existing, ...incoming };
    // symbol/isin는 항상 대문자로 유지
    if (merged.symbol) merged.symbol = normalizeSymbol(merged.symbol);
    if (merged.isin) merged.isin = normalizeIsin(merged.isin);
    return merged;
};

export const registerInstruments = (
    tickers = [],
    { markInitialized = false } = {}
) => {
    if (!Array.isArray(tickers)) return;

    tickers.forEach((ticker) => {
        if (!ticker) return;

        const symbol = normalizeSymbol(ticker.symbol);
        const isin = normalizeIsin(ticker.isin);

        const payload = {
            ...ticker,
            symbol,
            isin,
        };

        if (symbol) {
            state.bySymbol[symbol] = mergeInstrument(
                state.bySymbol[symbol],
                payload
            );
        }

        if (isin) {
            state.byIsin[isin] = mergeInstrument(state.byIsin[isin], payload);
            if (symbol) {
                state.bySymbol[symbol] = mergeInstrument(
                    state.bySymbol[symbol],
                    {
                        isin,
                    }
                );
            }
        }
    });

    if (markInitialized) {
        state.hasNavSnapshot = true;
    }
};

export const resolveInstrumentBySymbol = (symbol) => {
    const normalized = normalizeSymbol(symbol);
    return normalized ? state.bySymbol[normalized] || null : null;
};

export const resolveInstrumentByIsin = (isin) => {
    const normalized = normalizeIsin(isin);
    return normalized ? state.byIsin[normalized] || null : null;
};

export const resolveInstrument = ({ symbol, isin } = {}) => {
    const byIsin = isin ? resolveInstrumentByIsin(isin) : null;
    if (byIsin) return byIsin;
    return symbol ? resolveInstrumentBySymbol(symbol) : null;
};

export const ensureInstrumentDirectory = async () => {
    if (state.hasNavSnapshot) return;

    if (!navLoadPromise) {
        navLoadPromise = (async () => {
            try {
                await loadSymbolIsinSnapshot();
                const response = await fetch(getDataUrl('nav.json'));
                if (!response.ok) {
                    throw new Error(
                        `nav.json fetch 실패 (status: ${response.status})`
                    );
                }

                const navData = await response.json();
                const navTickers = Array.isArray(navData?.nav)
                    ? navData.nav
                    : [];
                registerInstruments(navTickers, { markInitialized: true });
            } catch (error) {
                console.error(
                    '[InstrumentDirectory] nav.json 로드 실패:',
                    error
                );
            } finally {
                navLoadPromise = null;
            }
        })();
    }

    await navLoadPromise;
};

export const instrumentState = state;
