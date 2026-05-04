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
            <div class="flex gap-2 justify-content-center mb-4">
                <Button label="내 포트폴리오" icon="pi pi-briefcase" severity="primary" rounded size="small" @click="router.push('/asset')" />
                <Button label="배당 달력" icon="pi pi-calendar" severity="secondary" rounded size="small" outlined @click="router.push('/calendar')" />
            </div>
            <div class="search-container px-3 w-full max-w-30rem mx-auto mb-4">
                <span class="p-input-icon-left w-full">
                    <i class="pi pi-search" />
                    <InputText placeholder="ETF 또는 티커 검색 (예: SCHD)" class="w-full border-round-3xl" @click="router.push('/calendar')" />
                </span>
            </div>
        </header>

        <!-- 신규 큐레이션 보드 (쇼핑몰 UI) -->
        <HomeCurationBoard />
        
        <!-- 하단 추가 메뉴 -->
        <article class="flex flex-column gap-2 px-3 mt-4">
            <Button label="백테스트 시뮬레이터" icon="pi pi-history" severity="secondary" text @click="router.push('/backtester')" />
            <Button v-if="!user" label="로그인 및 회원가입" icon="pi pi-user" severity="secondary" text @click="router.push('/login')" />
        </article>
    </main>
</template>
