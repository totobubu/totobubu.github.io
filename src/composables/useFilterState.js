// \composables\useFilterState.js
import { ref } from 'vue';
import { FilterMatchMode } from '@primevue/core/api';
import { db } from '../firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';

// --- 모든 상태 변수는 파일 최상단에 정의 ---

const filters = ref({
    global: { value: null, matchMode: FilterMatchMode.CONTAINS },
    company: { value: null, matchMode: FilterMatchMode.EQUALS },
    frequency: { value: null, matchMode: FilterMatchMode.EQUALS },
    group: { value: null, matchMode: FilterMatchMode.EQUALS },
    yield: { value: null, matchMode: FilterMatchMode.GREATER_THAN_OR_EQUAL_TO },
});

const showMyStocksOnly = ref(false);

// *** 핵심 수정 1: 변수 이름을 myBookmarks로 변경하고 초기값을 객체로 설정 ***
const myBookmarks = ref({});

// --- Firestore와 통신하는 헬퍼 함수들 ---

// *** 핵심 수정 2: 함수 이름이 'saveMyBookmarksToFirestore'가 맞는지 확인 ***
export const saveMyBookmarksToFirestore = async (userId, bookmarks) => {
    if (!userId) return;
    try {
        const userDocRef = doc(db, 'userBookmarks', userId);
        await setDoc(userDocRef, { bookmarks: bookmarks });
    } catch (error) {
        console.error('Firestore에 북마크 저장 실패:', error);
    }
};

// *** 핵심 수정 3: 함수 이름이 'loadMyBookmarksFromFirestore'가 맞는지 확인 ***
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
        return {}; // 에러 시 빈 객체 반환
    }
};

// --- 상태를 직접 변경하는 함수 ---
// --- 핵심: toggleMyStock 함수 추가 ---
const toggleMyStock = (symbol) => {
    if (!symbol) return;

    if (myBookmarks.value[symbol]) {
        // 이미 북마크 되어있으면 -> 삭제
        delete myBookmarks.value[symbol];
    } else {
        // 북마크 안 되어있으면 -> 기본 데이터 구조로 추가
        myBookmarks.value[symbol] = {
            avgPrice: 0,
            quantity: 0,
            accumulatedDividend: 0,
            targetAsset: 0,
        };
    }
};

// --- 핵심: 북마크 업데이트 함수 추가 ---
const updateBookmarkDetails = (symbol, details) => {
    if (!symbol || !details) return;

    // 1. 먼저 해당 종목이 북마크에 있는지 확인합니다.
    if (!myBookmarks.value[symbol]) {
        // 북마크에 없다면, 먼저 기본 구조로 추가합니다 (toggleMyStock과 동일 로직)
        myBookmarks.value[symbol] = {
            avgPrice: 0,
            quantity: 0,
            accumulatedDividend: 0,
            targetAsset: 0,
        };
    }

    // 2. 전달받은 details 객체의 내용으로 기존 값을 덮어씁니다.
    //    Object.assign을 사용하면, details에 포함된 키의 값만 업데이트됩니다.
    //    예: details가 { avgPrice: 15 } 이면, quantity 등 다른 값은 유지됩니다.
    myBookmarks.value[symbol] = { ...myBookmarks.value[symbol], ...details };
    console.log(`${symbol} 북마크 업데이트:`, myBookmarks.value[symbol]);
};

// --- 최종적으로 상태와 함수를 내보내는 Composable 함수 ---
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
