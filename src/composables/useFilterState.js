// src/composables/useFilterState.js
import { ref, watch } from 'vue';
import { db } from '../firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import {
    ensureInstrumentDirectory,
    resolveInstrumentByIsin,
    resolveInstrumentBySymbol,
} from '@/store/instruments';

const globalSearchQuery = ref(null);
const mainFilterTab = ref('미국'); // 기본값을 '미국'으로 유지
const subFilterTab = ref('ETF');

const myBookmarks = ref({});

const isProbableIsin = (value) => {
    if (typeof value !== 'string') return false;
    const token = value.trim().toUpperCase();
    return token.length === 12 && /^[A-Z]{2}[A-Z0-9]{10}$/.test(token);
};

const resolveCandidateToIsin = (candidate) => {
    if (!candidate) return null;
    if (typeof candidate === 'string') {
        const normalized = candidate.trim().toUpperCase();
        if (isProbableIsin(normalized)) return normalized;
        const instrument = resolveInstrumentBySymbol(normalized);
        return instrument?.isin || null;
    }
    return null;
};

const createBookmarkPayload = (instrument = {}, overrides = {}) => {
    const symbol = instrument.symbol || overrides.symbol;
    const isin =
        (overrides.isin && overrides.isin.toUpperCase()) ||
        (instrument.isin && instrument.isin.toUpperCase()) ||
        null;
    return {
        symbol: symbol ? symbol.toUpperCase() : null,
        isin,
        market: overrides.market ?? instrument.market ?? null,
        currency: overrides.currency ?? instrument.currency ?? null,
        avgPrice: overrides.avgPrice ?? 0,
        quantity: overrides.quantity ?? 0,
        accumulatedDividend: overrides.accumulatedDividend ?? 0,
        targetAsset: overrides.targetAsset ?? 0,
    };
};

const serializeBookmarks = (bookmarks) => {
    const serialized = {};
    Object.values(bookmarks || {}).forEach((value) => {
        if (!value) return;
        const payload = createBookmarkPayload(value, value);
        const { symbol, isin } = payload;
        if (!symbol || !isin) return;
        serialized[symbol] = {
            ...payload,
            symbol,
            isin,
        };
    });
    return serialized;
};

watch(mainFilterTab, (newTab) => {
    if (newTab === '미국' || newTab === '한국') {
        subFilterTab.value = 'ETF';
    }
});

export const saveMyBookmarksToFirestore = async (userId, bookmarks) => {
    if (!userId) return;
    try {
        const userDocRef = doc(db, 'userBookmarks', userId);
        await setDoc(userDocRef, { bookmarks: serializeBookmarks(bookmarks) });
    } catch (error) {
        console.error('Firestore에 북마크 저장 실패:', error);
    }
};

const normalizeBookmarks = (rawBookmarks = {}) => {
    const normalized = {};
    Object.entries(rawBookmarks).forEach(([key, value]) => {
        const isin =
            (value?.isin && value.isin.toUpperCase()) ||
            resolveCandidateToIsin(key);
        if (!isin) return;

        const instrument =
            resolveInstrumentByIsin(isin) ||
            resolveInstrumentBySymbol(value?.symbol || key);

        const payload = createBookmarkPayload(instrument, {
            ...value,
            isin,
        });

        normalized[isin] = payload;
    });
    return normalized;
};

export const loadMyBookmarksFromFirestore = async (userId) => {
    if (!userId) return {};
    try {
        await ensureInstrumentDirectory();
        const userDocRef = doc(db, 'userBookmarks', userId);
        const docSnap = await getDoc(userDocRef);
        if (!docSnap.exists()) return {};
        const rawBookmarks = docSnap.data().bookmarks || {};
        return normalizeBookmarks(rawBookmarks);
    } catch (error) {
        console.error('Firestore에서 북마크 로드 실패:', error);
        return {};
    }
};

const toggleMyStock = (ticker) => {
    if (!ticker) return null;

    const candidate =
        typeof ticker === 'string' ? { symbol: ticker } : { ...ticker };

    const normalizedSymbol = candidate.symbol
        ? candidate.symbol.toUpperCase()
        : null;

    const instrument =
        (candidate.isin && resolveInstrumentByIsin(candidate.isin)) ||
        (normalizedSymbol && resolveInstrumentBySymbol(normalizedSymbol)) ||
        (candidate.isin
            ? { ...candidate, isin: candidate.isin.toUpperCase() }
            : null);

    const isin =
        (candidate.isin && candidate.isin.toUpperCase()) ||
        instrument?.isin ||
        resolveCandidateToIsin(normalizedSymbol);

    if (!isin) return null;

    if (myBookmarks.value[isin]) {
        delete myBookmarks.value[isin];
        return 'removed';
    }

    const payload = createBookmarkPayload(instrument, {
        ...candidate,
        symbol: normalizedSymbol,
        isin,
    });
    myBookmarks.value[isin] = payload;
    return 'added';
};

const updateBookmarkDetails = (identifier, details) => {
    if (!identifier || !details) return;

    const identifierIsin = isProbableIsin(identifier)
        ? identifier.toUpperCase()
        : null;

    const instrument =
        (identifierIsin && resolveInstrumentByIsin(identifierIsin)) ||
        resolveInstrumentBySymbol(identifier);

    const isin =
        identifierIsin ||
        instrument?.isin ||
        resolveCandidateToIsin(identifier) ||
        Object.keys(myBookmarks.value).find((key) => {
            const entry = myBookmarks.value[key];
            return entry?.symbol === identifier.toUpperCase();
        });

    if (!isin) return;

    const existing =
        myBookmarks.value[isin] || createBookmarkPayload(instrument, { isin });

    myBookmarks.value[isin] = {
        ...existing,
        ...details,
        isin,
        symbol:
            existing.symbol || instrument?.symbol || identifier.toUpperCase(),
    };
};

export function useFilterState() {
    return {
        globalSearchQuery,
        mainFilterTab,
        subFilterTab,
        myBookmarks,
        toggleMyStock,
        updateBookmarkDetails,
    };
}
