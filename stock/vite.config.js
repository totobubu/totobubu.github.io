import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
// 'path'는 Node.js 내장 모듈이므로 그대로 사용합니다.
import path from 'path' 
import AutoImport from 'unplugin-auto-import/vite'
import Components from 'unplugin-vue-components/vite';
import { PrimeVueResolver } from '@primevue/auto-import-resolver';

// https://vitejs.dev/config/
export default defineConfig(({ command }) => {
  // GitHub 저장소 이름을 정확히 입력합니다.
  const repoName = 'etf'

  return {
    appType: 'spa',
    // ---------------------------------------------------------------
    // [경로 설정]
    // ---------------------------------------------------------------
    // 개발 서버에서는 루트(`/`)를, 빌드 시에는 저장소 이름 경로를 사용
    base: command === 'serve' ? '/' : `/${repoName}/`,

    // public 디렉토리의 위치를 명시적으로 지정합니다. 
    // 기본값이 'public'이므로, 혹시 모를 문제를 방지하기 위해 추가합니다.
    publicDir: 'public',

    // ---------------------------------------------------------------
    // [플러그인 설정]
    // ---------------------------------------------------------------
    plugins: [
      vue(),
      AutoImport({
        imports: ['vue', 'vue-router'],
        dts: 'src/auto-imports.d.ts',
      }),
      Components({
        resolvers: [PrimeVueResolver()],
        dts: 'src/components.d.ts',
      }),
    ],
    
    // ---------------------------------------------------------------
    // [경로 별칭 설정]
    // ---------------------------------------------------------------
    resolve: {
      alias: {
        // `path.resolve` 대신 Vue 3 / Vite의 표준 방식인 `fileURLToPath`를 사용합니다.
        '@': fileURLToPath(new URL('./src', import.meta.url))
      }
    },

    // ---------------------------------------------------------------
    // [빌드 설정]
    // ---------------------------------------------------------------
    build: {
      // 빌드 결과물이 생성될 폴더 이름 (기본값: 'dist')
      outDir: 'dist',
      // 빌드된 파일(assets)의 경로 설정. 기본값은 'assets'입니다.
      assetsDir: 'assets',
    }
  }
})