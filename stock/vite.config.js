import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import Components from 'unplugin-vue-components/vite'
import { PrimeVueResolver } from 'unplugin-vue-components/resolvers'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    vue(),
    // AutoImport 플러그인은 잠시 제거하고, Components 플러그인만 사용합니다.
    // 이것이 PrimeVue 컴포넌트를 자동으로 가져오는 핵심입니다.
    Components({
      resolvers: [
        PrimeVueResolver()
      ],
      // d.ts 파일 경로를 명시하지 않으면, 기본 경로에 자동으로 생성됩니다.
      // 경로 문제일 수 있으므로 이 옵션을 제거하여 테스트합니다.
      // dts: 'src/components.d.ts', 
    }),
  ],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url))
    }
  },
  server: {
    proxy: {
      '/api': {
        target: 'https://totobubu-github-io.vercel.app',
        changeOrigin: true,
      }
    }
  }
})