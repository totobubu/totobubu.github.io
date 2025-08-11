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

const myStockSymbols = ref([]);

// --- Firestore와 통신하는 헬퍼 함수들 ---
// 이 함수들은 다른 파일(auth.js)에서 사용할 것이므로 export 해줍니다.

export const saveMyStocksToFirestore = async (userId, stocks) => {
    if (!userId) return;
    try {
        const userDocRef = doc(db, 'userBookmarks', userId);
        await setDoc(userDocRef, { symbols: stocks });
    } catch (error) {
        console.error('Firestore에 북마크 저장 실패:', error);
    }
};

export const loadMyStocksFromFirestore = async (userId) => {
    if (!userId) return [];
    try {
        const userDocRef = doc(db, 'userBookmarks', userId);
        const docSnap = await getDoc(userDocRef);
        if (docSnap.exists()) {
            return docSnap.data().symbols || [];
        }
        return [];
    } catch (error) {
        console.error('Firestore에서 북마크 로드 실패:', error);
        return [];
    }
};

// --- 상태를 직접 변경하는 함수 ---
// 이 함수는 useFilterState()를 통해 컴포넌트에서 사용됩니다.

const toggleMyStock = (symbol) => {
    if (!symbol) return;
    const index = myStockSymbols.value.indexOf(symbol);
    if (index === -1) {
        myStockSymbols.value.push(symbol);
    } else {
        myStockSymbols.value.splice(index, 1);
    }
};

// --- 최종적으로 상태와 함수를 내보내는 Composable 함수 ---
// 이 함수가 이 파일의 유일한 기본 export 입니다.

export function useFilterState() {
    return {
        filters,
        showMyStocksOnly,
        myStockSymbols,
        toggleMyStock,
        toggleShowMyStocksOnly: () => {
            showMyStocksOnly.value = !showMyStocksOnly.value;
        },
    };
}
