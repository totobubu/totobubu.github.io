import { fileURLToPath, URL } from 'node:url';
import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import Components from 'unplugin-vue-components/vite';
import { PrimeVueResolver } from 'unplugin-vue-components/resolvers';
import { VitePWA } from 'vite-plugin-pwa';

// https://vitejs.dev/config/
export default defineConfig({
    plugins: [
        vue(),
        // AutoImport 플러그인은 잠시 제거하고, Components 플러그인만 사용합니다.
        // 이것이 PrimeVue 컴포넌트를 자동으로 가져오는 핵심입니다.
        Components({
            resolvers: [PrimeVueResolver()],
            // d.ts 파일 경로를 명시하지 않으면, 기본 경로에 자동으로 생성됩니다.
            // 경로 문제일 수 있으므로 이 옵션을 제거하여 테스트합니다.
            // dts: 'src/components.d.ts',
        }),
        VitePWA({
            registerType: 'autoUpdate', // 업데이트가 있으면 자동으로 리로드
            injectRegister: 'auto',
            workbox: {
                globPatterns: ['**/*.{js,css,html,ico,png,svg}'], // 캐싱할 파일 패턴
            },
            manifest: {
                name: 'DivGrow - 자산 성장 관리앱',
                short_name: 'DivGrow',
                description: '배당 성장으로 파이어를 꿈꾸는 사람들을 위한 앱',
                theme_color: '#09090b', // 앱 상단바 색상
                start_url: '/',
                display: 'standalone',
                background_color: '#09090b',
                icons: [
                    // 다양한 사이즈의 앱 아이콘 등록 (필수!)
                    {
                        src: '@/assets/android-chrome-192x192.png',
                        sizes: '192x192',
                        type: 'image/png',
                    },
                    {
                        src: '@/assets/android-chrome-512x512.png',
                        sizes: '512x512',
                        type: 'image/png',
                    },
                    {
                        src: '@/assets/android-chrome-512x512.png',
                        sizes: '512x512',
                        type: 'image/png',
                        purpose: 'any maskable', // 아이콘이 동그랗게 잘려도 괜찮게 보임
                    },
                ],
            },
        }),
    ],
    resolve: {
        alias: {
            '@': fileURLToPath(new URL('./src', import.meta.url)),
        },
    },
    server: {
        proxy: {
            '/api': {
                // --- Vercel 배포 주소 확인 ---
                target: 'https://totobubu-github-io.vercel.app',
                changeOrigin: true,
                // (선택) 더 복잡한 문제를 해결하기 위해 rewrite 추가
                rewrite: (path) => path.replace(/^\/api/, '/api'),
            },
        },
    },
});
