// \store\auth.js
import { ref, watch } from 'vue';
import { auth, signOut } from '../firebase';
import { onAuthStateChanged } from 'firebase/auth';
import {
    useFilterState,
    loadMyBookmarksFromFirestore,
    saveMyBookmarksToFirestore,
} from '@/composables/useFilterState';
// import { router } from '@/router'; // --- 이 줄을 완전히 삭제합니다 ---

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
        showMyStocksOnly.value = true;
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

// --- router.afterEach(...) 블록을 여기서 완전히 삭제합니다 ---

watch(
    myBookmarks,
    (newBookmarks) => {
        if (user.value) {
            saveMyBookmarksToFirestore(user.value.uid, newBookmarks);
        }
    },
    { deep: true }
);
