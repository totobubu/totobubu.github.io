// vite.config.js
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

// https://vitejs.dev/config/
export default defineConfig({
    // base는 '/' 로 고정합니다. User Site에서는 이것이 정답입니다.
    base: '/',
    plugins: [vue()],
})