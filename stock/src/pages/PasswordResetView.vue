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
                <div class="flex flex-column gap-3 mt-3">
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

<script setup>
    import { ref } from 'vue';
    import { sendPasswordResetEmail } from 'firebase/auth';
    import { auth } from '../firebase';
    import { useRouter } from 'vue-router';

    const email = ref('');
    const router = useRouter();

    const onResetPassword = async () => {
        if (!email.value) {
            alert('이메일을 입력해주세요.');
            return;
        }
        try {
            await sendPasswordResetEmail(auth, email.value);
            alert(
                '비밀번호 재설정 이메일을 발송했습니다. 메일함을 확인해주세요.'
            );
            router.push('/login');
        } catch (err) {
            console.error('비밀번호 재설정 실패:', err);
            alert('오류가 발생했습니다: ' + err.message);
        }
    };
</script>
