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
<script setup>
    import { ref } from 'vue';
    import { useRouter } from 'vue-router'; // useRouter 추가
    import {
        signInWithEmailAndPassword,
        setPersistence, // setPersistence 추가
        browserLocalPersistence, // Local Persistence (브라우저를 닫아도 유지) 추가
        browserSessionPersistence, // Session Persistence (탭/창을 닫으면 해제) 추가
    } from 'firebase/auth';
    import { auth } from '../firebase';

    import Checkbox from 'primevue/checkbox';
    import InputText from 'primevue/inputtext';

    const email = ref('');
    const password = ref('');
    const rememberMe = ref(true); // v-model 이름을 checked1에서 rememberMe로 변경 (의미 명확화)
    const router = useRouter(); // router 인스턴스 생성

    const onLogin = async () => {
        try {
            // 1. 로그인 방식 설정 (로그인 요청 전에 해야 함)
            const persistenceType = rememberMe.value
                ? browserLocalPersistence // 체크 O: 로컬 스토리지에 저장
                : browserSessionPersistence; // 체크 X: 세션 스토리지에 저장

            await setPersistence(auth, persistenceType);

            // 2. 로그인 시도
            const userCredential = await signInWithEmailAndPassword(
                auth,
                email.value,
                password.value
            );

            console.log('로그인 성공:', userCredential.user.email);
            router.push('/'); // 로그인 성공 후 홈으로 이동
        } catch (err) {
            console.error('로그인 실패:', err);
            alert('로그인 실패: ' + err.message);
        }
    };
</script>
