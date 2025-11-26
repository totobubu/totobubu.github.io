// src/composables/useAssetFirestore.js
import { ref, computed } from 'vue';
import {
    collection,
    doc,
    getDoc,
    setDoc,
    addDoc,
    updateDoc,
    deleteDoc,
    getDocs,
} from 'firebase/firestore';
import { db } from '@/firebase';
// import { user } from '@/store/auth'; // user는 페이지에서 전달받음

/**
 * Firestore 데이터 구조:
 *
 * userAssets/{userId}/familyMembers/{memberId}
 *   - name: string
 *   - relationship: string (본인, 배우자, 자녀, 부모 등)
 *
 * userAssets/{userId}/familyMembers/{memberId}/accounts/{accountId}
 *   - name: string
 *   - brokerageId: string
 *   - accountNumber: string
 *
 * userAssets/{userId}/familyMembers/{memberId}/accounts/{accountId}/assets/{assetId}
 *   - type: string (주식, 현금, 외환예금, 코인)
 *   - isin?: string (ISIN 코드)
 *   - symbol?: string (주식 심볼, ISIN에서 매핑된 값)
 *   - koName?: string (한국어 종목명)
 *   - koNameApprovalStatus?: string (pending, approved, rejected)
 *   - amount: number
 *   - currency: string (KRW, USD 등)
 *   - notes?: string
 */

/**
 * 가족 멤버 관리
 */
export const useFamilyMembers = () => {
    const familyMembers = ref([]);
    const isLoading = ref(false);

    const loadFamilyMembers = async (userId) => {
        if (!userId) return;
        console.log('📥 loadFamilyMembers called with userId:', userId);
        isLoading.value = true;
        try {
            const membersRef = collection(
                db,
                `userAssets/${userId}/familyMembers`
            );
            const snapshot = await getDocs(membersRef);
            const data = snapshot.docs.map((doc) => ({
                id: doc.id,
                ...doc.data(),
            }));
            console.log('📊 Loaded data:', data);
            familyMembers.value = data;
            console.log('✅ familyMembers.value updated:', familyMembers.value);
        } catch (error) {
            console.error('가족 멤버 불러오기 실패:', error);
        } finally {
            isLoading.value = false;
        }
    };

    const addFamilyMember = async (userId, memberData) => {
        if (!userId) return;
        try {
            const membersRef = collection(
                db,
                `userAssets/${userId}/familyMembers`
            );
            const docRef = await addDoc(membersRef, {
                ...memberData,
                createdAt: new Date(),
            });
            return docRef.id;
        } catch (error) {
            console.error('가족 멤버 추가 실패:', error);
            throw error;
        }
    };

    const updateFamilyMember = async (userId, memberId, memberData) => {
        if (!userId) return;
        try {
            const memberRef = doc(
                db,
                `userAssets/${userId}/familyMembers/${memberId}`
            );
            await updateDoc(memberRef, memberData);
        } catch (error) {
            console.error('가족 멤버 수정 실패:', error);
            throw error;
        }
    };

    const deleteFamilyMember = async (userId, memberId) => {
        if (!userId) return;
        try {
            // 서브컬렉션도 함께 삭제해야 함 (Firestore는 자동으로 서브컬렉션을 삭제하지 않음)
            const memberRef = doc(
                db,
                `userAssets/${userId}/familyMembers/${memberId}`
            );
            await deleteDoc(memberRef);
        } catch (error) {
            console.error('가족 멤버 삭제 실패:', error);
            throw error;
        }
    };

    return {
        familyMembers,
        isLoading,
        loadFamilyMembers,
        addFamilyMember,
        updateFamilyMember,
        deleteFamilyMember,
    };
};

/**
 * 증권사 관리
 */
export const useBrokerages = () => {
    const isLoading = ref(false);

    const loadBrokerages = async (userId, memberId) => {
        if (!userId || !memberId) return [];
        isLoading.value = true;
        try {
            const brokeragesRef = collection(
                db,
                `userAssets/${userId}/familyMembers/${memberId}/brokerages`
            );
            const snapshot = await getDocs(brokeragesRef);
            return snapshot.docs.map((doc) => ({
                id: doc.id,
                ...doc.data(),
            }));
        } catch (error) {
            console.error('증권사 불러오기 실패:', error);
            return [];
        } finally {
            isLoading.value = false;
        }
    };

    const addBrokerage = async (userId, memberId, brokerageData) => {
        if (!userId || !memberId) return;
        try {
            const brokeragesRef = collection(
                db,
                `userAssets/${userId}/familyMembers/${memberId}/brokerages`
            );
            const docRef = await addDoc(brokeragesRef, {
                ...brokerageData,
                createdAt: new Date(),
            });
            return docRef.id;
        } catch (error) {
            console.error('증권사 추가 실패:', error);
            throw error;
        }
    };

    const updateBrokerage = async (
        userId,
        memberId,
        brokerageId,
        brokerageData
    ) => {
        if (!userId || !memberId) return;
        try {
            const brokerageRef = doc(
                db,
                `userAssets/${userId}/familyMembers/${memberId}/brokerages/${brokerageId}`
            );
            await updateDoc(brokerageRef, brokerageData);
        } catch (error) {
            console.error('증권사 수정 실패:', error);
            throw error;
        }
    };

    const deleteBrokerage = async (userId, memberId, brokerageId) => {
        if (!userId || !memberId) return;
        try {
            const brokerageRef = doc(
                db,
                `userAssets/${userId}/familyMembers/${memberId}/brokerages/${brokerageId}`
            );
            await deleteDoc(brokerageRef);
        } catch (error) {
            console.error('증권사 삭제 실패:', error);
            throw error;
        }
    };

    return {
        isLoading,
        loadBrokerages,
        addBrokerage,
        updateBrokerage,
        deleteBrokerage,
    };
};

/**
 * 계좌 관리
 */
export const useAccounts = () => {
    const isLoading = ref(false);

    const loadAccounts = async (userId, memberId) => {
        if (!userId || !memberId) return [];
        isLoading.value = true;
        try {
            const accountsRef = collection(
                db,
                `userAssets/${userId}/familyMembers/${memberId}/accounts`
            );
            const snapshot = await getDocs(accountsRef);
            return snapshot.docs.map((doc) => ({
                id: doc.id,
                ...doc.data(),
            }));
        } catch (error) {
            console.error('계좌 불러오기 실패:', error);
            return [];
        } finally {
            isLoading.value = false;
        }
    };

    const addAccount = async (userId, memberId, accountData) => {
        if (!userId || !memberId) return;
        try {
            const accountsRef = collection(
                db,
                `userAssets/${userId}/familyMembers/${memberId}/accounts`
            );
            const docRef = await addDoc(accountsRef, {
                ...accountData,
                createdAt: new Date(),
            });
            return docRef.id;
        } catch (error) {
            console.error('계좌 추가 실패:', error);
            throw error;
        }
    };

    const updateAccount = async (userId, memberId, accountId, accountData) => {
        if (!userId || !memberId) return;
        try {
            const accountRef = doc(
                db,
                `userAssets/${userId}/familyMembers/${memberId}/accounts/${accountId}`
            );
            await updateDoc(accountRef, accountData);
        } catch (error) {
            console.error('계좌 수정 실패:', error);
            throw error;
        }
    };

    const deleteAccount = async (userId, memberId, accountId) => {
        if (!userId || !memberId) return;
        try {
            const accountRef = doc(
                db,
                `userAssets/${userId}/familyMembers/${memberId}/accounts/${accountId}`
            );
            await deleteDoc(accountRef);
        } catch (error) {
            console.error('계좌 삭제 실패:', error);
            throw error;
        }
    };

    return {
        isLoading,
        loadAccounts,
        addAccount,
        updateAccount,
        deleteAccount,
    };
};

/**
 * 자산 항목 관리
 */
export const useAssets = () => {
    const isLoading = ref(false);

    const loadAssets = async (userId, memberId, accountId) => {
        if (!userId || !memberId || !accountId) return [];
        isLoading.value = true;
        try {
            const assetsRef = collection(
                db,
                `userAssets/${userId}/familyMembers/${memberId}/accounts/${accountId}/assets`
            );
            const snapshot = await getDocs(assetsRef);
            return snapshot.docs.map((doc) => ({
                id: doc.id,
                ...doc.data(),
            }));
        } catch (error) {
            console.error('자산 불러오기 실패:', error);
            return [];
        } finally {
            isLoading.value = false;
        }
    };

    const addAsset = async (userId, memberId, accountId, assetData) => {
        if (!userId || !memberId || !accountId) return;
        try {
            const assetsRef = collection(
                db,
                `userAssets/${userId}/familyMembers/${memberId}/accounts/${accountId}/assets`
            );
            const docRef = await addDoc(assetsRef, {
                ...assetData,
                createdAt: new Date(),
            });
            return docRef.id;
        } catch (error) {
            console.error('자산 추가 실패:', error);
            throw error;
        }
    };

    const updateAsset = async (
        userId,
        memberId,
        accountId,
        assetId,
        assetData
    ) => {
        if (!userId || !memberId || !accountId) return;
        try {
            const assetRef = doc(
                db,
                `userAssets/${userId}/familyMembers/${memberId}/accounts/${accountId}/assets/${assetId}`
            );
            await updateDoc(assetRef, assetData);
        } catch (error) {
            console.error('자산 수정 실패:', error);
            throw error;
        }
    };

    const deleteAsset = async (userId, memberId, accountId, assetId) => {
        if (!userId || !memberId || !accountId) return;
        try {
            const assetRef = doc(
                db,
                `userAssets/${userId}/familyMembers/${memberId}/accounts/${accountId}/assets/${assetId}`
            );
            await deleteDoc(assetRef);
        } catch (error) {
            console.error('자산 삭제 실패:', error);
            throw error;
        }
    };

    return {
        isLoading,
        loadAssets,
        addAsset,
        updateAsset,
        deleteAsset,
    };
};

/**
 * 거래 내역 관리
 */
export const useTransactions = () => {
    const isLoading = ref(false);

    const loadTransactions = async (userId, memberId, accountId, assetId) => {
        if (!userId || !memberId || !accountId || !assetId) return [];
        isLoading.value = true;
        try {
            const transactionsRef = collection(
                db,
                `userAssets/${userId}/familyMembers/${memberId}/accounts/${accountId}/assets/${assetId}/transactions`
            );
            const snapshot = await getDocs(transactionsRef);
            return snapshot.docs.map((doc) => ({
                id: doc.id,
                ...doc.data(),
            }));
        } catch (error) {
            console.error('거래 내역 불러오기 실패:', error);
            return [];
        } finally {
            isLoading.value = false;
        }
    };

    const addTransaction = async (
        userId,
        memberId,
        accountId,
        assetId,
        transactionData
    ) => {
        if (!userId || !memberId || !accountId || !assetId) return;
        try {
            const transactionsRef = collection(
                db,
                `userAssets/${userId}/familyMembers/${memberId}/accounts/${accountId}/assets/${assetId}/transactions`
            );
            const docRef = await addDoc(transactionsRef, {
                ...transactionData,
                createdAt: new Date(),
            });
            return docRef.id;
        } catch (error) {
            console.error('거래 내역 추가 실패:', error);
            throw error;
        }
    };

    return {
        isLoading,
        loadTransactions,
        addTransaction,
    };
};
