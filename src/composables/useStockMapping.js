// src/composables/useStockMapping.js
/**
 * 증권사별 종목명 매핑 관리
 * 
 * Firestore 구조:
 * stockMappings/{brokerage}_{stockName}/
 *   - brokerage: string (toss, kb, mirae 등)
 *   - brokerageStockName: string (토스증권 종목명)
 *   - brokerageTicker: string (토스 내부 티커)
 *   - systemTicker: string (우리 시스템 티커, 예: AAPL)
 *   - stockInfo: object (종목 정보)
 *   - createdAt: timestamp
 *   - createdBy: string (최초 등록 사용자 ID)
 *   - updatedAt: timestamp
 */

import { ref } from 'vue';
import {
    collection,
    doc,
    getDoc,
    setDoc,
    deleteDoc,
    query,
    where,
    getDocs,
} from 'firebase/firestore';
import { db } from '@/firebase';
import axios from 'axios';

/**
 * 종목명 매핑 키 생성
 */
const getMappingKey = (brokerage, stockName) => {
    // 공백 제거 및 소문자 변환
    const normalizedName = stockName.replace(/\s+/g, '_').toLowerCase();
    return `${brokerage}_${normalizedName}`;
};

/**
 * 매핑 정보 조회
 */
export const getStockMapping = async (brokerage, stockName) => {
    try {
        const mappingKey = getMappingKey(brokerage, stockName);
        const mappingRef = doc(db, 'stockMappings', mappingKey);
        const mappingDoc = await getDoc(mappingRef);

        if (mappingDoc.exists()) {
            return mappingDoc.data();
        }
        return null;
    } catch (error) {
        console.error('매핑 정보 조회 실패:', error);
        return null;
    }
};

/**
 * 매핑 정보 저장 (공용)
 */
export const saveStockMapping = async (brokerage, stockName, mappingData, userId) => {
    try {
        const mappingKey = getMappingKey(brokerage, stockName);
        const mappingRef = doc(db, 'stockMappings', mappingKey);

        // 기존 매핑 확인
        const existingDoc = await getDoc(mappingRef);
        const now = new Date();

        const data = {
            brokerage,
            brokerageStockName: stockName,
            brokerageTicker: mappingData.brokerageTicker,
            systemTicker: mappingData.systemTicker,
            stockInfo: mappingData.stockInfo,
            updatedAt: now,
        };

        if (existingDoc.exists()) {
            // 업데이트
            await setDoc(mappingRef, data, { merge: true });
        } else {
            // 신규 생성
            data.createdAt = now;
            data.createdBy = userId;
            await setDoc(mappingRef, data);
        }

        return true;
    } catch (error) {
        console.error('매핑 정보 저장 실패:', error);
        throw error;
    }
};

/**
 * 매핑 정보 삭제
 */
export const deleteStockMapping = async (brokerage, stockName) => {
    try {
        const mappingKey = getMappingKey(brokerage, stockName);
        const mappingRef = doc(db, 'stockMappings', mappingKey);
        await deleteDoc(mappingRef);
        return true;
    } catch (error) {
        console.error('매핑 정보 삭제 실패:', error);
        throw error;
    }
};

/**
 * 증권사별 모든 매핑 조회
 */
export const getAllMappings = async (brokerage) => {
    try {
        const mappingsRef = collection(db, 'stockMappings');
        const q = query(mappingsRef, where('brokerage', '==', brokerage));
        const snapshot = await getDocs(q);

        const mappings = [];
        snapshot.forEach((doc) => {
            mappings.push({
                id: doc.id,
                ...doc.data(),
            });
        });

        return mappings;
    } catch (error) {
        console.error('매핑 목록 조회 실패:', error);
        return [];
    }
};

/**
 * 티커 검색 (우리 시스템)
 */
export const searchSymbol = async (searchQuery) => {
    try {
        const response = await axios.get('/api/searchSymbol.js', {
            params: {
                q: searchQuery,
            },
        });
        return response.data.results || [];
    } catch (error) {
        console.error('티커 검색 실패:', error);
        return [];
    }
};

/**
 * 여러 종목명을 한 번에 매핑 (배치)
 */
export const batchGetStockMappings = async (brokerage, stockNames) => {
    const mappings = new Map();

    try {
        // Firestore in 쿼리는 최대 10개까지만 가능하므로 청크로 나눔
        const chunkSize = 10;
        for (let i = 0; i < stockNames.length; i += chunkSize) {
            const chunk = stockNames.slice(i, i + chunkSize);
            const mappingKeys = chunk.map((name) => getMappingKey(brokerage, name));

            const promises = mappingKeys.map((key) => {
                const mappingRef = doc(db, 'stockMappings', key);
                return getDoc(mappingRef);
            });

            const docs = await Promise.all(promises);
            docs.forEach((doc, index) => {
                if (doc.exists()) {
                    mappings.set(chunk[index], doc.data());
                }
            });
        }

        return mappings;
    } catch (error) {
        console.error('배치 매핑 조회 실패:', error);
        return mappings;
    }
};

