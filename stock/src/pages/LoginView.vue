<template>
    <div id="t-auth">
        <Card>
            <!-- <div
            class="flex flex-column bg-surface-0 dark:bg-surface-900 p-8 md:p-12 shadow-sm rounded-2xl w-full max-w-sm mx-auto flex flex-col gap-8"> -->
            <template #header>
                <div class="flex flex-col items-center gap-4">
                    <div class="flex flex-column items-center gap-2 w-full">
                        <div
                            class="text-surface-900 dark:text-surface-0 text-2xl font-semibold leading-tight text-center w-full">
                            Welcome Back
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
            </template>
            <template #content>
                <div class="flex flex-column gap-6 w-full">
                    <div class="flex flex-col gap-2 w-full">
                        <label
                            for="email"
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
                            for="password"
                            class="text-surface-900 dark:text-surface-0 font-medium leading-normal"
                            >Password</label
                        >
                        <Password
                            v-model="password"
                            placeholder="Password"
                            toggleMask
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
            </template>

            <template #footer>
                <Button
                    @click="onLogin"
                    label="Sign In"
                    icon="pi pi-user"
                    class="w-full py-2 rounded-lg flex justify-center items-center gap-2">
                    <template #icon>
                        <i class="pi pi-user text-base! leading-normal!" />
                    </template>
                </Button>
            </template>
            <!-- </div> -->
        </Card>
    </div>
</template>
<script setup>
    import { ref } from 'vue';

    const checked1 = ref(true);
    import { signInWithEmailAndPassword, auth } from '../firebase';

    import Checkbox from 'primevue/checkbox';
    import InputText from 'primevue/inputtext';

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
