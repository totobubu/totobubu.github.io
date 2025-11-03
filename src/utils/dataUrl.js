// src/utils/dataUrl.js
/**
 * 데이터 URL 생성 헬퍼
 * 환경에 따라 로컬 또는 R2 URL을 반환
 */
import { joinURL } from 'ufo';

const USE_R2 = import.meta.env.VITE_USE_R2 === 'true';
const R2_PUBLIC_URL = import.meta.env.VITE_R2_PUBLIC_URL || '';

/**
 * 데이터 파일 URL 생성
 * @param {string} path - 파일 경로 (예: 'data/005930-ks.json', 'nav.json')
 * @returns {string} 전체 URL
 */
export function getDataUrl(path) {
    if (USE_R2 && R2_PUBLIC_URL) {
        // R2 사용
        return `${R2_PUBLIC_URL}/${path}`;
    } else {
        // 로컬 파일 사용 (개발 환경)
        return joinURL(import.meta.env.BASE_URL, path);
    }
}

/**
 * 현재 R2를 사용하는지 확인
 * @returns {boolean}
 */
export function isUsingR2() {
    return USE_R2 && !!R2_PUBLIC_URL;
}

