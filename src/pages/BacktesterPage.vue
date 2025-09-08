<script setup>
    import { useHead } from '@vueuse/head';
    import PortfolioBacktester from '@/components/backtester/PortfolioBacktester.vue';

    useHead({
        title: '포트폴리오 백테스터',
    });
</script>

<template>
    <div id="t-backtester-page" class="p-4">
        <div class="flex justify-content-between align-items-center mb-4">
            <h1 class="text-3xl font-bold">포트폴리오 백테스터</h1>
        </div>

        <PortfolioBacktester />
    </div>
</template>
