import { ref, watch } from 'vue';
import { auth } from '../firebase';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import {
    useFilterState,
    loadMyStocksFromFirestore,
    saveMyStocksToFirestore,
} from '../composables/useFilterState';

export const user = ref(null);

const { showMyStocksOnly, myStockSymbols } = useFilterState();

// handleSignOut 함수는 Layout.vue에서 사용하므로 export를 유지합니다.
export const handleSignOut = async () => {
    await signOut(auth);
};

onAuthStateChanged(auth, async (firebaseUser) => {
    if (firebaseUser) {
        // 로그인 시 로직
        user.value = {
            uid: firebaseUser.uid,
            email: firebaseUser.email,
            displayName: firebaseUser.displayName,
        };
        showMyStocksOnly.value = true;
        myStockSymbols.value = await loadMyStocksFromFirestore(
            firebaseUser.uid
        );
    } else {
        // 로그아웃 또는 탈퇴 시 로직
        user.value = null;
        showMyStocksOnly.value = false;
        myStockSymbols.value = [];
    }
});

// 사용자의 북마크 변경을 감시하여 Firestore에 저장하는 로직
watch(
    myStockSymbols,
    (newSymbols) => {
        if (user.value) {
            saveMyStocksToFirestore(user.value.uid, newSymbols);
        }
    },
    { deep: true }
);
