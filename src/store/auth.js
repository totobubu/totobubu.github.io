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

const { myBookmarks } = useFilterState(); // showMyStocksOnly 제거

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
        myBookmarks.value = await loadMyBookmarksFromFirestore(
            firebaseUser.uid
        );
    } else {
        isRecentlyAuthenticated.value = false;
        user.value = null;
        myBookmarks.value = {}; // showMyStocksOnly 관련 코드 제거
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
