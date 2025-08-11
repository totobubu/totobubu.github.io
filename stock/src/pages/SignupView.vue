<template>
    <!-- <div class="p-4 max-w-md mx-auto">
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
    </div> -->
    <div class="bg-surface-50 dark:bg-surface-950 px-6 py-20 md:px-20 lg:px-80">
        <div
            class="bg-surface-0 dark:bg-surface-900 p-8 md:p-12 shadow-sm rounded-2xl w-full max-w-sm mx-auto flex flex-col gap-8">
            <div class="flex flex-col items-center gap-4">
                <div class="flex flex-col items-center gap-2 w-full">
                    <div
                        class="text-surface-900 dark:text-surface-0 text-2xl font-semibold leading-tight text-center w-full">
                        회원가입
                    </div>
                    <div class="text-center w-full">
                        <span
                            class="text-surface-700 dark:text-surface-200 leading-normal"
                            >Don't have an account?</span
                        >
                        <a
                            class="text-primary font-medium ml-1 cursor-pointer hover:text-primary-emphasis"
                            >Create today!</a
                        >
                    </div>
                </div>
            </div>
            <div class="flex flex-col gap-6 w-full">
                <div class="flex flex-col gap-2 w-full">
                    <label
                        for="email1"
                        class="text-surface-900 dark:text-surface-0 font-medium leading-normal"
                        >Email Address</label
                    >
                    <InputText
                        v-model="email"
                        type="text"
                        placeholder="Email address"
                        class="w-full px-3 py-2 shadow-sm rounded-lg" />
                </div>
                <div class="flex flex-col gap-2 w-full">
                    <label
                        for="password1"
                        class="text-surface-900 dark:text-surface-0 font-medium leading-normal"
                        >Password</label
                    >
                    <InputText
                        v-model="password"
                        toggleMask
                        type="password"
                        placeholder="Password"
                        class="w-full px-3 py-2 shadow-sm rounded-lg" />
                </div>
                <div
                    class="flex flex-col sm:flex-row items-start sm:items-center justify-between w-full gap-3 sm:gap-0">
                    <div class="flex items-center gap-2">
                        <Checkbox
                            id="rememberme1"
                            v-model="checked1"
                            :binary="true" />
                        <label
                            for="rememberme1"
                            class="text-surface-900 dark:text-surface-0 leading-normal"
                            >Remember me</label
                        >
                    </div>
                    <a
                        class="text-primary font-medium cursor-pointer hover:text-primary-emphasis"
                        >Forgot your password?</a
                    >
                </div>
            </div>
            <Button
                label="Sign In"
                icon="pi pi-user"
                class="w-full py-2 rounded-lg flex justify-center items-center gap-2">
                <template #icon>
                    <i class="pi pi-user text-base! leading-normal!" />
                </template>
            </Button>
        </div>
    </div>
</template>
<script setup>
    import { ref } from 'vue';

    import { auth } from '../firebase';
    import { createUserWithEmailAndPassword } from 'firebase/auth';
    import { useRouter } from 'vue-router';

    import Checkbox from 'primevue/checkbox';
    import InputText from 'primevue/inputtext';

    const checked1 = ref(true);

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
