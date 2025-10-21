<!-- REFACTORED: src/pages/HomeView.vue -->
<script setup>
    import { useHead } from '@vueuse/head';
    import { useRouter } from 'vue-router';
    import Button from 'primevue/button';
    import { user } from '../store/auth';

    const router = useRouter();

    useHead({
        title: '홈',
    });
</script>

<template>
    <main id="t-home">
        <header class="t-home-header">
            <p class="logo">
                <img src="/src/assets/apple-touch-icon.png" alt="" />
            </p>
            <h1 class="h1">배당모아 Div Grow</h1>
            <h2>파이어족을 위한 배당 포트폴리오 추적 플랫폼</h2>
            <p class="desc">
                ETF부터 개별주까지, 나만의 배당금 성장 기록과 관리. 지금 바로
                배당의 여정을 시작하세요.
            </p>
        </header>

        <article class="t-home-link">
            <Button
                label="배당달력"
                icon="pi pi-calendar"
                severity="secondary"
                rounded
                size="large"
                @click="router.push('/calendar')" />
            <Button
                label="백테스터"
                icon="pi pi-history"
                severity="secondary"
                rounded
                size="large"
                @click="router.push('/backtester')" />
            <Button
                v-if="!user"
                label="로그인"
                icon="pi pi-user"
                severity="secondary"
                rounded
                size="large"
                @click="router.push('/login')" />
            <Button
                v-else
                label="북마크"
                icon="pi pi-star"
                severity="secondary"
                rounded
                size="large"
                @click="router.push('/bookmarks')" />
            <Button
                label="문의하기"
                icon="pi pi-envelope"
                severity="secondary"
                rounded
                size="large"
                @click="router.push('/contact')" />
        </article>
    </main>
</template>
