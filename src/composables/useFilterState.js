import { ref } from 'vue';
import { FilterMatchMode } from '@primevue/core/api';
import { db } from '../firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';

const filters = ref({
    global: { value: null, matchMode: FilterMatchMode.CONTAINS },
    // marketType 필터 제거
    company: { value: null, matchMode: FilterMatchMode.EQUALS },
    frequency: { value: null, matchMode: FilterMatchMode.EQUALS },
    group: { value: null, matchMode: FilterMatchMode.EQUALS },
    yield: { value: null, matchMode: FilterMatchMode.GREATER_THAN_OR_EQUAL_TO },
});

const showMyStocksOnly = ref(false);
const myBookmarks = ref({});

export const saveMyBookmarksToFirestore = async (userId, bookmarks) => {
    if (!userId) return;
    try {
        const userDocRef = doc(db, 'userBookmarks', userId);
        await setDoc(userDocRef, { bookmarks: bookmarks });
    } catch (error) {
        console.error('Firestore에 북마크 저장 실패:', error);
    }
};

export const loadMyBookmarksFromFirestore = async (userId) => {
    if (!userId) return {};
    try {
        const userDocRef = doc(db, 'userBookmarks', userId);
        const docSnap = await getDoc(userDocRef);
        if (docSnap.exists()) {
            return docSnap.data().bookmarks || {};
        }
        return {};
    } catch (error) {
        console.error('Firestore에서 북마크 로드 실패:', error);
        return {};
    }
};

const toggleMyStock = (symbol) => {
    if (!symbol) return;
    if (myBookmarks.value[symbol]) {
        delete myBookmarks.value[symbol];
    } else {
        myBookmarks.value[symbol] = {
            avgPrice: 0,
            quantity: 0,
            accumulatedDividend: 0,
            targetAsset: 0,
        };
    }
};

const updateBookmarkDetails = (symbol, details) => {
    if (!symbol || !details) return;
    if (!myBookmarks.value[symbol]) {
        myBookmarks.value[symbol] = {
            avgPrice: 0,
            quantity: 0,
            accumulatedDividend: 0,
            targetAsset: 0,
        };
    }
    myBookmarks.value[symbol] = { ...myBookmarks.value[symbol], ...details };
};

export function useFilterState() {
    return {
        filters,
        showMyStocksOnly,
        myBookmarks,
        toggleMyStock,
        toggleShowMyStocksOnly: () => {
            showMyStocksOnly.value = !showMyStocksOnly.value;
        },
        updateBookmarkDetails,
    };
}