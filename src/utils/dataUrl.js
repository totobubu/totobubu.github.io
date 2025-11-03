// src/utils/dataUrl.js
/**
 * 데이터 URL 생성 헬퍼
 */
import { joinURL } from 'ufo';

const USE_R2 = import.meta.env.VITE_USE_R2 === 'true';
const R2_PUBLIC_URL = import.meta.env.VITE_R2_PUBLIC_URL || '';

/**
 * 데이터 파일 URL 생성
 */
export function getDataUrl(path) {
    if (USE_R2 && R2_PUBLIC_URL) {
        return `${R2_PUBLIC_URL}/${path}`;
    } else {
        return joinURL(import.meta.env.BASE_URL, path);
    }
}

/**
 * R2 사용 여부 확인
 */
export function isUsingR2() {
    return USE_R2 && !!R2_PUBLIC_URL;
}

