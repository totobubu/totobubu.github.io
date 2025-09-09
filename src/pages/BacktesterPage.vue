<!-- src\pages\BacktesterPage.vue -->
<script setup>
    import { useHead } from '@vueuse/head';
    import PortfolioBacktester from '@/components/backtester/PortfolioBacktester.vue';

    useHead({
        title: '포트폴리오 백테스터',
    });
</script>

<template>
    <div id="t-backtester-page">
        <PortfolioBacktester />
    </div>
</template>
