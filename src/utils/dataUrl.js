// src/utils/dataUrl.js
/**
 * 데이터 URL 생성 헬퍼
 * 
 * 로컬 개발 환경에서는 항상 로컬 파일을 사용합니다.
 * 프로덕션 빌드에서만 R2를 사용할 수 있습니다.
 */
import { joinURL } from 'ufo';

const USE_R2 = import.meta.env.VITE_USE_R2 === 'true';
const R2_PUBLIC_URL = import.meta.env.VITE_R2_PUBLIC_URL || '';
const IS_DEV = import.meta.env.DEV;

/**
 * 데이터 파일 URL 생성
 * 
 * 로컬 개발 환경에서는 항상 로컬 파일을 사용합니다.
 */
export function getDataUrl(path) {
    // 개발 환경에서는 항상 로컬 파일 사용
    if (IS_DEV) {
        return joinURL(import.meta.env.BASE_URL, path);
    }
    
    // 프로덕션에서만 R2 사용 옵션 적용
    if (USE_R2 && R2_PUBLIC_URL) {
        return `${R2_PUBLIC_URL}/${path}`;
    } else {
        return joinURL(import.meta.env.BASE_URL, path);
    }
}

/**
 * R2 사용 여부 확인
 * 
 * 개발 환경에서는 항상 false를 반환합니다.
 */
export function isUsingR2() {
    // 개발 환경에서는 항상 로컬 파일 사용
    if (IS_DEV) {
        return false;
    }
    return USE_R2 && !!R2_PUBLIC_URL;
}

