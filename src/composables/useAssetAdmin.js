// src/composables/useAssetAdmin.js
// 관리자용 자산 관리 기능

import { ref } from 'vue';
import { collectionGroup, query, where, getDocs, updateDoc, doc } from 'firebase/firestore';
import { db } from '@/firebase';

/**
 * 승인 대기 중인 koName 목록 조회
 */
export const useKoNameApprovals = () => {
    const pendingApprovals = ref([]);
    const isLoading = ref(false);

    const loadPendingApprovals = async () => {
        isLoading.value = true;
        pendingApprovals.value = [];
        
        try {
            console.log('🔍 승인 대기 목록 조회 시작...');
            
            // collectionGroup을 사용하여 모든 사용자의 assets 서브컬렉션 조회
            const assetsRef = collectionGroup(db, 'assets');
            const q = query(
                assetsRef,
                where('koNameApprovalStatus', '==', 'pending')
            );
            
            console.log('📊 쿼리 실행 중...');
            const snapshot = await getDocs(q);
            console.log('✅ 쿼리 완료. 문서 개수:', snapshot.size);
            
            const approvals = [];
            
            snapshot.forEach((docSnapshot) => {
                const data = docSnapshot.data();
                const pathParts = docSnapshot.ref.path.split('/');
                
                console.log('📄 문서 경로:', docSnapshot.ref.path);
                console.log('📄 문서 데이터:', data);
                
                // 경로에서 userId, memberId, brokerageId, accountId 추출
                // userAssets/{userId}/familyMembers/{memberId}/brokerages/{brokerageId}/accounts/{accountId}/assets/{assetId}
                const userId = pathParts[1];
                const memberId = pathParts[3];
                const brokerageId = pathParts[5];
                const accountId = pathParts[7];
                const assetId = docSnapshot.id;
                
                approvals.push({
                    id: assetId,
                    userId,
                    memberId,
                    brokerageId,
                    accountId,
                    ...data,
                });
            });
            
            console.log('✅ 승인 대기 항목:', approvals);
            pendingApprovals.value = approvals;
        } catch (error) {
            console.error('❌ 승인 대기 목록 조회 실패:', error);
            console.error('❌ 에러 상세:', {
                message: error.message,
                code: error.code,
                stack: error.stack,
            });
            // collectionGroup 쿼리가 실패할 경우 (인덱스 미설정 등)
            // 빈 배열 반환
            pendingApprovals.value = [];
            throw error; // 에러를 다시 throw하여 UI에서 처리할 수 있도록
        } finally {
            isLoading.value = false;
        }
    };

    return {
        pendingApprovals,
        isLoading,
        loadPendingApprovals,
    };
};

/**
 * koName 승인 처리
 * 승인 시 해당 symbol의 정식 koName으로 사용할 수 있도록 업데이트
 */
export const approveKoName = async (userId, memberId, brokerageId, accountId, assetId, koName, symbol) => {
    try {
        const assetRef = doc(
            db,
            `userAssets/${userId}/familyMembers/${memberId}/brokerages/${brokerageId}/accounts/${accountId}/assets/${assetId}`
        );
        
        await updateDoc(assetRef, {
            koNameApprovalStatus: 'approved',
            koName: koName,
            approvedAt: new Date(),
        });
        
        // TODO: symbol이 있는 경우 해당 symbol의 데이터 파일에 koName을 업데이트하는 로직 추가
        // 예: public/data/{market}/{symbol}.json 파일에 koName 필드 추가
        // 이는 별도의 API 엔드포인트나 Cloud Function을 통해 처리하는 것이 좋습니다.
        
        return true;
    } catch (error) {
        console.error('koName 승인 실패:', error);
        throw error;
    }
};

/**
 * koName 거부 처리
 */
export const rejectKoName = async (userId, memberId, brokerageId, accountId, assetId) => {
    try {
        const assetRef = doc(
            db,
            `userAssets/${userId}/familyMembers/${memberId}/brokerages/${brokerageId}/accounts/${accountId}/assets/${assetId}`
        );
        
        await updateDoc(assetRef, {
            koNameApprovalStatus: 'rejected',
            rejectedAt: new Date(),
        });
        
        return true;
    } catch (error) {
        console.error('koName 거부 실패:', error);
        throw error;
    }
};

