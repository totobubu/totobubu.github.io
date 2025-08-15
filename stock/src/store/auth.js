import { ref, watch } from 'vue';
import { auth, signOut } from '../firebase'; // signOut import
import { onAuthStateChanged } from 'firebase/auth';
import {
    useFilterState,
    loadMyStocksFromFirestore,
    saveMyStocksToFirestore,
} from '../composables/useFilterState';

export const user = ref(null);
export const isRecentlyAuthenticated = ref(false); // 새로운 상태 추가

const { showMyStocksOnly, myStockSymbols } = useFilterState();


// 로그아웃 원인을 저장할 상태 (객체로 관리)
const signOutReason = ref({
    byUser: false,
    byEmailChange: false
});

// onAuthStateChanged는 그대로 두고, 로그아웃/이메일 변경 함수를 새로 만듭니다.
export const handleSignOut = async () => {
    signOutReason.value.byUser = true;
    await signOut(auth);
};

// MyPageView에서 이메일 변경 성공 후 호출될 함수
export const handleSignOutAfterEmailChange = async () => {
    signOutReason.value.byEmailChange = true;
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
        isRecentlyAuthenticated.value = false; // 로그아웃 시 무조건 초기화
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
