<!-- stock\src\pages\SignupView.vue -->
<script setup>
    import { ref } from 'vue';
    import { auth } from '../firebase';
    import { createUserWithEmailAndPassword } from 'firebase/auth';
    import { useRouter } from 'vue-router';
    import Message from 'primevue/message';
    import { useToast } from 'primevue/usetoast'; // useToast import 추가

    const email = ref('');
    const password = ref('');
    const router = useRouter();
    const toast = useToast(); // toast 인스턴스 생성

    const errorMessage = ref('');
    const isLoading = ref(false); // 로딩 상태 추가

    const signUp = async () => {
        errorMessage.value = '';
        isLoading.value = true; // 로딩 시작
        try {
            await createUserWithEmailAndPassword(
                auth,
                email.value,
                password.value
            );

            // --- 성공 피드백 로직 추가 ---
            toast.add({
                severity: 'success',
                summary: '회원가입 성공',
                detail: '로그인 페이지로 이동합니다.',
                life: 3000,
            });

            // Toast 메시지가 보일 시간을 주기 위해 약간의 딜레이 후 이동
            setTimeout(() => {
                router.push('/login?from=signup');
            }, 1500); // 1.5초 후 이동
        } catch (err) {
            console.error('회원가입 실패:', err.code);
            // Firebase 에러 코드에 따라 사용자 친화적인 메시지 설정
            if (err.code === 'auth/email-already-in-use') {
                errorMessage.value = '이미 사용 중인 이메일입니다.';
            } else if (err.code === 'auth/weak-password') {
                errorMessage.value = '비밀번호는 6자리 이상이어야 합니다.';
            } else {
                errorMessage.value = '회원가입 중 오류가 발생했습니다.';
                isLoading.value = false; // 에러 발생 시 로딩 종료
            }
        }
        // 성공 시에는 setTimeout 때문에 여기서 로딩을 끝내지 않습니다.
    };
</script>

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
                <!-- 에러 메시지가 있을 경우에만 Message 컴포넌트를 표시 -->
                <Message
                    v-if="errorMessage"
                    severity="error"
                    :closable="false"
                    class="mb-4">
                    {{ errorMessage }}
                </Message>

                <div class="flex flex-column gap-3 mt-3">
                    <!-- 버튼에 로딩 상태 바인딩 -->
                    <Button
                        @click="signUp"
                        label="회원가입"
                        :loading="isLoading" />
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
