<script setup>
    import { useHead } from '@vueuse/head';
    import Layout from './layouts/Layout.vue';

    useHead({
        // %s는 각 페이지 컴포넌트에서 설정한 title 값으로 대체됩니다.
        titleTemplate: '%s - 배당 나무 (Div Grow)',
    });
</script>

<template>
    <Layout />
</template>
