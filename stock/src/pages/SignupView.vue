<script setup>
    import { ref } from 'vue';
    import { auth } from '../firebase';
    import { createUserWithEmailAndPassword } from 'firebase/auth';
    import { useRouter } from 'vue-router';
    import Message from 'primevue/message'; // Message 컴포넌트 import

    const email = ref('');
    const password = ref('');
    const router = useRouter();

    // 에러 메시지를 저장할 ref 추가
    const errorMessage = ref('');

    const signUp = async () => {
        errorMessage.value = '';
        try {
            await createUserWithEmailAndPassword(
                auth,
                email.value,
                password.value
            );
            // alert('회원가입 성공! 로그인 페이지로 이동합니다.'); // alert 제거

            // 로그인 페이지로 이동하면서, 회원가입을 통해 왔다는 표시를 남깁니다.
            router.push('/login?from=signup');
        } catch (err) {
            console.error('회원가입 실패:', err.code);
            // Firebase 에러 코드에 따라 사용자 친화적인 메시지 설정
            if (err.code === 'auth/email-already-in-use') {
                errorMessage.value = '이미 사용 중인 이메일입니다.';
            } else if (err.code === 'auth/weak-password') {
                errorMessage.value = '비밀번호는 6자리 이상이어야 합니다.';
            } else {
                errorMessage.value = '회원가입 중 오류가 발생했습니다.';
            }
            // alert('회원가입 실패: ' + err.message); // alert 제거
        }
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
                    <Button @click="signUp" label="회원가입" />
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
