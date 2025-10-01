// \store\auth.js
import { ref, watch } from 'vue';
import { auth, signOut } from '../firebase';
import { onAuthStateChanged } from 'firebase/auth';
import {
    useFilterState,
    loadMyBookmarksFromFirestore,
    saveMyBookmarksToFirestore,
} from '@/composables/useFilterState';

export const user = ref(null);
export const isRecentlyAuthenticated = ref(false);

const { showMyStocksOnly, myBookmarks } = useFilterState();

export const handleSignOut = async () => {
    await signOut(auth);
};

onAuthStateChanged(auth, async (firebaseUser) => {
    if (firebaseUser) {
        user.value = {
            uid: firebaseUser.uid,
            email: firebaseUser.email,
            displayName: firebaseUser.displayName,
        };
        // [핵심 수정] 로그인 시 북마크 필터를 활성화하지 않고, 기본값(false)을 유지합니다.
        // showMyStocksOnly.value = true; // 이 줄을 주석 처리하거나 삭제합니다.
        myBookmarks.value = await loadMyBookmarksFromFirestore(
            firebaseUser.uid
        );
    } else {
        isRecentlyAuthenticated.value = false;
        user.value = null;
        showMyStocksOnly.value = false;
        myBookmarks.value = {};
    }
});

watch(
    myBookmarks,
    (newBookmarks) => {
        if (user.value) {
            saveMyBookmarksToFirestore(user.value.uid, newBookmarks);
        }
    },
    { deep: true }
);
