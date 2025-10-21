// src/composables/useFilterState.js
import { ref, watch } from 'vue';
import { db } from '../firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';

const globalSearchQuery = ref(null);
// --- [핵심 수정] mainFilterTab의 기본값을 '북마크'로 변경 ---
const mainFilterTab = ref('북마크');
// --- // ---
const subFilterTab = ref('ETF');

const myBookmarks = ref({});

watch(mainFilterTab, (newTab) => {
    if (newTab === '미국' || newTab === '한국') {
        subFilterTab.value = 'ETF';
    }
});

export const saveMyBookmarksToFirestore = async (userId, bookmarks) => {
    if (!userId) return;
    try {
        const userDocRef = doc(db, 'userBookmarks', userId);
        await setDoc(userDocRef, { bookmarks });
    } catch (error) {
        console.error('Firestore에 북마크 저장 실패:', error);
    }
};

export const loadMyBookmarksFromFirestore = async (userId) => {
    if (!userId) return {};
    try {
        const userDocRef = doc(db, 'userBookmarks', userId);
        const docSnap = await getDoc(userDocRef);
        return docSnap.exists() ? docSnap.data().bookmarks || {} : {};
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
        globalSearchQuery,
        mainFilterTab,
        subFilterTab,
        myBookmarks,
        toggleMyStock,
        updateBookmarkDetails,
    };
}