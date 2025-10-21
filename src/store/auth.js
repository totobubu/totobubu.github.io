// src/store/auth.js
import { ref, watch } from 'vue';
import { auth, signOut } from '../firebase';
import { onAuthStateChanged } from 'firebase/auth';
import {
    useFilterState,
    loadMyBookmarksFromFirestore,
    saveMyBookmarksToFirestore,
} from '@/composables/useFilterState';
import router from '@/router'; // [추가] router import

export const user = ref(null);
export const isRecentlyAuthenticated = ref(false);

const { myBookmarks } = useFilterState();

// --- [핵심 수정] ---
export const handleSignOut = async () => {
    await signOut(auth);
    // 로그아웃 후 홈으로 리디렉션
    router.push('/');
};
// --- // ---

onAuthStateChanged(auth, async (firebaseUser) => {
    if (firebaseUser) {
        user.value = {
            uid: firebaseUser.uid,
            email: firebaseUser.email,
            displayName: firebaseUser.displayName,
        };
        myBookmarks.value = await loadMyBookmarksFromFirestore(
            firebaseUser.uid
        );
    } else {
        isRecentlyAuthenticated.value = false;
        user.value = null;
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