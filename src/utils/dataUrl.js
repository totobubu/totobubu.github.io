// src/utils/dataUrl.js
/**
 * 데이터 URL 생성 헬퍼
 *
 * 정적 파일은 현재 배포의 BASE_URL 아래에서 제공합니다.
 */
import { joinURL } from 'ufo';

const normalizePath = (path) => {
    if (!path) return '';
    return path.startsWith('/') ? path.slice(1) : path;
};

const buildAssetUrl = (path) => {
    const normalizedPath = normalizePath(path);
    if (!normalizedPath) {
        return joinURL(import.meta.env.BASE_URL, '');
    }

    return joinURL(import.meta.env.BASE_URL, normalizedPath);
};

/**
 * 데이터/정적 파일 URL 생성
 *
 * 현재 배포의 정적 파일 경로를 반환합니다.
 */
export function getDataUrl(path) {
    return buildAssetUrl(path);
}

/**
 * 로고와 같은 정적 자산 URL 생성
 */
export function getAssetUrl(path) {
    return buildAssetUrl(path);
}
