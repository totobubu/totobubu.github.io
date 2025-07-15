// --- 1. 필요한 모든 모듈과 함수를 import 합니다. ---
import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import AutoImport from 'unplugin-auto-import/vite'
import Components from 'unplugin-vue-components/vite'
import { PrimeVueResolver } from '@primevue/auto-import-resolver'

// https://vitejs.dev/config/
export default defineConfig({
  // --- 2. 기본 경로는 이제 항상 '/' 입니다. (User Site 방식) ---
  base: '/',
  
  // public 디렉토리를 명시적으로 지정해주는 것이 안전합니다.
  publicDir: 'public',

  // --- 3. 이제 모든 플러그인이 정상적으로 인식됩니다. ---
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
  
  // --- 4. 경로 별칭 설정도 이제 정상적으로 작동합니다. ---
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url))
    }
  }
})