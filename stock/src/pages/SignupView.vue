<template>
    <div class="p-4 max-w-md mx-auto">
        <h2 class="mb-4">회원가입</h2>
        <div class="p-fluid">
            <InputText v-model="email" placeholder="이메일" />
            <Password
                v-model="password"
                placeholder="비밀번호"
                toggleMask
                class="mt-3" />
            <Button label="회원가입" class="mt-4" @click="signUp" />
        </div>
    </div>
</template>

<script setup>
    import { ref } from 'vue';
    import { auth } from '../firebase';
    import { createUserWithEmailAndPassword } from 'firebase/auth';
    import { useRouter } from 'vue-router';

    const email = ref('');
    const password = ref('');
    const router = useRouter();

    const signUp = async () => {
        try {
            await createUserWithEmailAndPassword(
                auth,
                email.value,
                password.value
            );
            alert('회원가입 성공!');
            router.push('/login');
        } catch (err) {
            alert('회원가입 실패: ' + err.message);
        }
    };
</script>
