<!-- stock\src\pages\PasswordResetView.vue -->
<script setup>
    import { ref } from 'vue';
    import {
        sendPasswordResetEmail,
        fetchSignInMethodsForEmail,
    } from 'firebase/auth';
    import { auth } from '../firebase';
    import { useRouter } from 'vue-router';
    import Message from 'primevue/message'; // Message 컴포넌트 import

    const email = ref('');
    const router = useRouter();

    // 메시지를 저장할 ref 추가 (성공, 에러 모두 사용)
    const message = ref({ text: '', severity: '' });

    const onResetPassword = async () => {
        message.value = { text: '', severity: '' };
        if (!email.value) {
            message.value = {
                text: '이메일을 입력해주세요.',
                severity: 'warn',
            };
            return;
        }
        try {
            // 1. Check if the email is registered
            const methods = await fetchSignInMethodsForEmail(auth, email.value);

            // 2. If no methods, user does not exist
            if (methods.length === 0) {
                message.value = {
                    text: '가입되지 않은 이메일입니다.',
                    severity: 'error',
                };
                return;
            }

            // 3. If user exists, send the reset email
            await sendPasswordResetEmail(auth, email.value);
            message.value = {
                text: '비밀번호 재설정 이메일을 발송했습니다. 메일함을 확인해주세요.',
                severity: 'success',
            };
        } catch (err) {
            console.error('비밀번호 재설정 과정 오류:', err);
            message.value = {
                text: '오류가 발생했습니다. 잠시 후 다시 시도해주세요.',
                severity: 'error',
            };
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
                        icon="pi pi-envelope"
                        severity="secondary"
                        rounded
                        disabled
                        aria-label="envelope" />
                </div>
            </template>
            <template #title>비밀번호 재설정</template>
            <template #subtitle
                >가입하신 이메일로 재설정 링크를 보내드립니다.</template
            >
            <template #content>
                <div class="flex flex-column gap-3">
                    <InputGroup>
                        <InputGroupAddon>
                            <i class="pi pi-user"></i>
                        </InputGroupAddon>
                        <InputText
                            v-model="email"
                            type="email"
                            size="large"
                            placeholder="가입한 이메일 ID"
                            @keyup.enter="onResetPassword" />
                    </InputGroup>
                </div>
            </template>
            <template #footer>
                <!-- 메시지가 있을 경우에만 Message 컴포넌트를 표시 -->
                <Message
                    v-if="message.text"
                    :severity="message.severity"
                    :closable="false"
                    class="mb-4">
                    {{ message.text }}
                </Message>

                <div class="flex flex-column gap-3">
                    <Button
                        @click="onResetPassword"
                        label="재설정 이메일 발송" />
                    <Button
                        label="로그인 페이지로"
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
