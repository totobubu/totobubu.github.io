<!-- REFACTORED: src/pages/HomeView.vue -->
<script setup>
import { useHead } from '@vueuse/head';
import { useRouter } from 'vue-router';
import Button from 'primevue/button';
import InputText from 'primevue/inputtext';
import HomeCurationBoard from '@/components/HomeCurationBoard.vue';
import { user } from '../store/auth';

const router = useRouter();

useHead({
    title: '홈',
});
</script>

<template>
    <main id="t-home" class="pb-6">
        <header class="t-home-header py-4">
            <p class="logo mb-2">
                <img src="/src/assets/apple-touch-icon.png" alt="" style="width: 48px; border-radius: 12px; box-shadow: 0 4px 8px rgba(0,0,0,0.1);" />
            </p>
            <h1 class="h1 text-2xl font-bold mb-1">배당모아 Div Grow</h1>
            <h2 class="text-color-secondary text-sm mb-3">해외 ETF 쇼핑 및 배당 포트폴리오 매니저</h2>
            
            <div class="search-container px-3 w-full max-w-30rem mx-auto mb-4">
                <span class="p-input-icon-left w-full">
                    <i class="pi pi-search" />
                    <InputText placeholder="ETF 또는 티커 검색 (예: SCHD)" class="w-full border-round-3xl" @click="router.push('/calendar')" />
                </span>
            </div>
            
            <!-- Quick Links (Restored from Original) -->
            <article class="t-home-link px-3 w-full max-w-30rem mx-auto mt-2">
                <Button label="내 포트폴리오" icon="pi pi-briefcase" severity="primary" rounded size="large" class="w-full mb-2" @click="router.push('/asset')" />
                <div class="grid grid-nogutter gap-2">
                    <div class="col">
                        <Button label="배당달력" icon="pi pi-calendar" severity="secondary" outlined rounded class="w-full" @click="router.push('/calendar')" />
                    </div>
                    <div class="col">
                        <Button label="백테스터" icon="pi pi-history" severity="secondary" outlined rounded class="w-full" @click="router.push('/backtester')" />
                    </div>
                </div>
                <div class="grid grid-nogutter gap-2 mt-2">
                    <div class="col">
                        <Button v-if="!user" label="로그인" icon="pi pi-user" severity="secondary" outlined rounded class="w-full" @click="router.push('/login')" />
                        <Button v-else label="북마크" icon="pi pi-star" severity="secondary" outlined rounded class="w-full" @click="router.push('/bookmark')" />
                    </div>
                    <div class="col">
                        <Button label="문의하기" icon="pi pi-envelope" severity="secondary" outlined rounded class="w-full" @click="router.push('/contact')" />
                    </div>
                </div>
            </article>
        </header>

        <!-- 신규 큐레이션 보드 (쇼핑몰 UI) -->
        <HomeCurationBoard />
    </main>
</template>
