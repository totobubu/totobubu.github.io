import { fileURLToPath, URL } from 'node:url';
import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';

export default defineConfig({
    plugins: [vue()],
    resolve: {
        alias: {
            // '@' 별칭이 './src'를 가리키도록 명확하게 설정
            '@': fileURLToPath(new URL('./src', import.meta.url)),
        },
    },
    // Vercel 배포 시, Root Directory를 'stock'으로 지정했으므로
    // Vite의 base 설정은 기본값인 '/'를 유지해야 합니다.
    base: '/',
});
