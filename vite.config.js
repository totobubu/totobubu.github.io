import { fileURLToPath, URL } from 'node:url' // <--- 이 줄이 중요합니다.
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import AutoImport from 'unplugin-auto-import/vite'
import Components from 'unplugin-vue-components/vite'
import { PrimeVueResolver } from '@primevue/auto-import-resolver'

export default defineConfig({
  base: '/',
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
  resolve: {
    // '@'가 'src' 폴더를 올바르게 가리키도록 하는 표준 설정입니다.
    // 이 설정이 없으면 빌드 시 경로 계산에 문제가 생깁니다.
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url))
    }
  }
})