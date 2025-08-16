<script setup>
    import { ref, onMounted } from 'vue'; // onMounted 추가
    import { useRouter, useRoute } from 'vue-router'; // useRoute 추가
    import {
        signInWithEmailAndPassword,
        setPersistence,
        browserLocalPersistence,
        browserSessionPersistence,
    } from 'firebase/auth';
    import { auth } from '../firebase';

    // PrimeVue 컴포넌트 추가
    import Message from 'primevue/message';
    import Checkbox from 'primevue/checkbox';
    import InputText from 'primevue/inputtext';

    const email = ref('');
    const password = ref('');
    const rememberMe = ref(true);
    const router = useRouter();
    const route = useRoute(); // 현재 라우트 정보를 가져오기 위해 추가

    // 에러 메시지를 저장할 ref 추가
    const errorMessage = ref('');
    const successMessage = ref('');

    onMounted(() => {
        // 페이지가 마운트될 때 쿼리 파라미터를 확인합니다.
        if (route.query.from === 'signup') {
            successMessage.value = '회원가입이 완료되었습니다. 로그인해주세요.';
        }
    });

    const onLogin = async () => {
        errorMessage.value = ''; // 시도할 때마다 이전 에러 메시지 초기화
        successMessage.value = ''; // 로그인 시도 시 성공 메시지는 초기화
        try {
            const persistenceType = rememberMe.value
                ? browserLocalPersistence
                : browserSessionPersistence;

            await setPersistence(auth, persistenceType);

            await signInWithEmailAndPassword(auth, email.value, password.value);

            // 로그인 성공 시 onAuthStateChanged가 홈으로 보낼 것이므로,
            // 여기서 명시적으로 이동할 필요가 없을 수도 있습니다.
            // 하지만 더 빠른 전환을 위해 유지합니다.
            router.push('/');
        } catch (err) {
            console.error('로그인 실패:', err.code);
            // Firebase 에러 코드에 따라 사용자 친화적인 메시지 설정
            if (
                err.code === 'auth/invalid-credential' ||
                err.code === 'auth/user-not-found' ||
                err.code === 'auth/wrong-password'
            ) {
                errorMessage.value = '이메일 또는 비밀번호를 확인해주세요.';
            } else {
                errorMessage.value = '로그인 중 오류가 발생했습니다.';
            }
            // alert('로그인 실패: ' + err.message); // alert 제거
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
                    <div class="flex flex-col justify-content-between text-sm">
                        <div class="flex items-center gap-2">
                            <Checkbox
                                id="rememberMe"
                                v-model="rememberMe"
                                :binary="true"
                                size="small" />
                            <label for="rememberMe">로그인 상태 유지</label>
                        </div>
                    </div>
                </div>
            </template>

            <template #footer>
                <!-- 성공 메시지가 있을 경우 -->
                <Message
                    v-if="successMessage"
                    severity="success"
                    :closable="false"
                    class="mb-4">
                    {{ successMessage }}
                </Message>

                <!-- 에러 메시지가 있을 경우 -->
                <Message
                    v-if="errorMessage"
                    severity="error"
                    :closable="false"
                    class="mb-4">
                    {{ errorMessage }}
                </Message>

                <div class="flex flex-column gap-3 mt-3">
                    <Button @click="onLogin" label="로그인" />
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
                        size="small"
                        asChild
                        v-slot="slotProps">
                        <RouterLink
                            to="/password-reset"
                            :class="slotProps.class"
                            >비밀번호 찾기</RouterLink
                        >
                    </Button>
                </div>
            </template>
        </Card>
    </div>
</template>
