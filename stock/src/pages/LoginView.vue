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
                    <div class="flex flex-col justify-content-between text-sm">
                        <div class="flex items-center gap-2">
                            <Checkbox
                                id="rememberme1"
                                v-model="checked1"
                                :binary="true"
                                size="small" />
                            <label for="rememberme1">로그인 상태 유지</label>
                        </div>
                    </div>
                </div>
            </template>

            <template #footer>
                <div class="flex flex-column gap-3 mt-3">
                    <Button @click="onLogin" label="로그인">
                        <template #icon> </template>
                    </Button>
                    <Button
                        label="회원가입"
                        severity="secondary"
                        variant="outlined"
                        asChild
                        v-slot="slotProps">
                        <RouterLink to="/signup" :class="slotProps.class"
                            >회원가입</RouterLink
                        >
                    </Button>

                    <Button
                        label="비밀번호 찾기"
                        severity="secondary"
                        variant="text"
                        size="small">
                        <template #icon> </template>
                    </Button>
                </div>
            </template>
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
