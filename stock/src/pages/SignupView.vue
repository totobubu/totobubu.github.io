<template>
    <div id="t-auth">
        <Card>
            <template #header>
                <div class="flex flex-col justify-content-center">
                    <Button
                        class="t-auth-icon"
                        icon="pi pi-unlock"
                        severity="secondary"
                        rounded
                        disabled
                        aria-label="unlock" />
                </div>
            </template>
            <template #content>
                <div class="flex flex-column gap-3">
                    <div class="flex flex-column gap-3">
                        <InputGroup>
                            <InputGroupAddon>
                                <i class="pi pi-user"></i>
                            </InputGroupAddon>
                            <InputText
                                v-model="email"
                                type="text"
                                size="large"
                                placeholder="이메일 ID" />
                        </InputGroup>
                        <InputGroup>
                            <InputGroupAddon>
                                <i class="pi pi-key"></i>
                            </InputGroupAddon>
                            <Password
                                v-model="password"
                                placeholder="비밀번호"
                                toggleMask />
                        </InputGroup>
                    </div>
                </div>
            </template>

            <template #footer>
                <div class="flex flex-column gap-3 mt-3">
                    <Button @click="signUp" label="회원가입">
                        <template #icon> </template>
                    </Button>
                    <Button
                        label="로그인"
                        severity="secondary"
                        variant="outlined"
                        asChild
                        v-slot="slotProps">
                        <RouterLink to="/login" :class="slotProps.class"
                            >로그인</RouterLink
                        >
                    </Button>
                </div>
            </template>
        </Card>
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
