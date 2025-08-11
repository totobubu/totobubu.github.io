import { ref, watch } from 'vue';
import { auth } from '../firebase';
import { onAuthStateChanged } from 'firebase/auth';
import {
    useFilterState,
    loadMyStocksFromFirestore, // Firestore 헬퍼 함수 import
    saveMyStocksToFirestore, // Firestore 헬퍼 함수 import
} from '../composables/useFilterState';

export const user = ref(null);
const { showMyStocksOnly, myStockSymbols } = useFilterState();

onAuthStateChanged(auth, async (firebaseUser) => {
    if (firebaseUser) {
        console.log('Auth Store: 로그인됨', firebaseUser.email);
        user.value = {
            uid: firebaseUser.uid,
            email: firebaseUser.email,
        };
        showMyStocksOnly.value = true;

        // 로그인 시 Firestore에서 북마크를 로드하여 상태에 반영
        myStockSymbols.value = await loadMyStocksFromFirestore(
            firebaseUser.uid
        );
        console.log('Firestore에서 북마크 로드 완료:', myStockSymbols.value);
    } else {
        console.log('Auth Store: 로그아웃됨');
        user.value = null;
        showMyStocksOnly.value = false;

        // 로그아웃 시 북마크 목록 초기화
        myStockSymbols.value = [];
    }
});

// myStockSymbols가 변경될 때마다 Firestore에 저장하는 로직
watch(
    myStockSymbols,
    (newSymbols) => {
        if (user.value) {
            // 로그인 상태일 때만 저장
            saveMyStocksToFirestore(user.value.uid, newSymbols);
        }
    },
    { deep: true }
);
