<!-- NEW FILE: src/pages/BookmarkView.vue -->

<script setup>
    import { useHead } from '@vueuse/head';
    import BookmarkManager from '@/components/mypage/BookmarkManager.vue';

    useHead({
        title: '북마크 관리',
    });
</script>

<template>
    <div id="t-bookmark-page">
        <BookmarkManager />
    </div>
</template>
