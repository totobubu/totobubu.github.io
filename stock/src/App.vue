<script setup>
    import { onAuthStateChanged } from 'firebase/auth';
    import { auth } from './firebase';
    import Layout from './layouts/Layout.vue';

    onAuthStateChanged(auth, (user) => {
        if (user) {
            console.log('로그인 유지됨:', user.email);
        } else {
            console.log('로그아웃 상태');
        }
    });
</script>

<template>
    <Layout />
</template>
