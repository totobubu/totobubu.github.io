<template>
    <div class="p-fluid">
        <h2>로그인</h2>
        <p-input-text v-model="email" placeholder="이메일" />
        <p-password v-model="password" placeholder="비밀번호" toggleMask />
        <p-button label="로그인" class="mt-3" @click="onLogin" />
    </div>
</template>

<script setup>
    import { ref } from 'vue';
    import { signInWithEmailAndPassword, auth } from '../firebase';

    const email = ref('');
    const password = ref('');

    const onLogin = async () => {
        try {
            const userCredential = await signInWithEmailAndPassword(
                auth,
                email.value,
                password.value
            );
            alert('로그인 성공: ' + userCredential.user.email);
        } catch (err) {
            alert('로그인 실패: ' + err.message);
        }
    };
</script>
