import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

export default defineConfig({
    base: '/',
    publicDir: 'public', // public 폴더를 명시적으로 지정
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
        alias: {
            '@': fileURLToPath(new URL('./src', import.meta.url))
        }
    }
})