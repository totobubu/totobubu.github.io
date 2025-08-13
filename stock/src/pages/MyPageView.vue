<!-- stock\src\pages\MyPageView.vue -->
<script setup>
    import { ref, onMounted } from 'vue';
    import { useRouter } from 'vue-router';
    import { auth, db } from '../firebase';
    import { user } from '../store/auth';
    import {
        updateProfile,
        updateEmail,
        updatePassword,
        deleteUser,
        EmailAuthProvider,
        reauthenticateWithCredential,
    } from 'firebase/auth';
    import { doc, setDoc, deleteDoc } from 'firebase/firestore';

    // PrimeVue 컴포넌트 및 서비스
    import Card from 'primevue/card';
    import Button from 'primevue/button';
    import InputText from 'primevue/inputtext';
    import Password from 'primevue/password';
    import Dialog from 'primevue/dialog';
    // import Toast from 'primevue/toast';
    // import ConfirmDialog from 'primevue/confirmdialog';
    import { useToast } from 'primevue/usetoast';
    import { useConfirm } from 'primevue/useconfirm';

    const router = useRouter();
    // const toast = useToast();
    // const confirm = useConfirm();

    // 각 기능별 상태
    const displayName = ref('');
    const newEmail = ref('');
    const newPassword = ref('');
    const isLoading = ref({
        displayName: false,
        email: false,
        password: false,
        reset: false,
        delete: false,
    });

    // 재인증 팝업 관련 상태
    const isReauthDialogVisible = ref(false);
    const currentPassword = ref('');
    let actionAfterReauth = null;

    // 마운트 시 현재 닉네임 가져오기
    onMounted(() => {
        displayName.value = user.value?.displayName || '';
    });

    // 1. 닉네임 변경 로직
    const handleUpdateDisplayName = async () => {
        if (!displayName.value.trim()) {
            toast.add({
                severity: 'warn',
                summary: '경고',
                detail: '닉네임을 입력해주세요.',
                life: 3000,
            });
            return;
        }
        isLoading.value.displayName = true;
        try {
            await updateProfile(auth.currentUser, {
                displayName: displayName.value,
            });
            // user 스토어의 값도 수동으로 업데이트 해줍니다.
            if (user.value) user.value.displayName = displayName.value;
            toast.add({
                severity: 'success',
                summary: '성공',
                detail: '닉네임이 변경되었습니다.',
                life: 3000,
            });
        } catch (error) {
            toast.add({
                severity: 'error',
                summary: '오류',
                detail: '닉네임 변경에 실패했습니다.',
                life: 3000,
            });
        } finally {
            isLoading.value.displayName = false;
        }
    };

    // 2. 재인증 팝업 열기 (이메일, 비밀번호, 탈퇴 공용)
    const openReauthDialog = (action) => {
        actionAfterReauth = action;
        isReauthDialogVisible.value = true;
        currentPassword.value = '';
    };

    // 3. 재인증 실행 및 후속 작업 처리
    const executeReauth = async () => {
        if (!currentPassword.value) return;

        const credential = EmailAuthProvider.credential(
            auth.currentUser.email,
            currentPassword.value
        );

        try {
            await reauthenticateWithCredential(auth.currentUser, credential);
            isReauthDialogVisible.value = false;

            // 재인증 성공 후, 원래 하려던 작업 실행
            if (actionAfterReauth === 'email') await performUpdateEmail();
            if (actionAfterReauth === 'password') await performUpdatePassword();
            if (actionAfterReauth === 'delete') await performDeleteUser();
        } catch (error) {
            toast.add({
                severity: 'error',
                summary: '인증 실패',
                detail: '비밀번호가 올바르지 않습니다.',
                life: 3000,
            });
        }
    };

    // 4. 이메일 주소 변경 실행
    const performUpdateEmail = async () => {
        if (!newEmail.value) {
            toast.add({
                severity: 'warn',
                summary: '경고',
                detail: '새 이메일 주소를 입력해주세요.',
                life: 3000,
            });
            return;
        }
        isLoading.value.email = true;
        try {
            await updateEmail(auth.currentUser, newEmail.value);
            // 성공 시에는 onAuthStateChanged가 처리하도록 여기서 아무것도 하지 않습니다.
            // Firebase가 이메일 변경 후 내부적으로 토큰을 만료시키고 로그아웃 상태로 만들 수 있습니다.
            // 강제로 로그아웃을 호출하여 상태 변화를 확실하게 트리거합니다.
            await signOut(auth);
        } catch (error) {
            toast.add({
                severity: 'error',
                summary: '오류',
                detail: '이메일 변경에 실패했습니다. (이미 사용 중이거나 유효하지 않은 이메일)',
                life: 3000,
            });
        } finally {
            isLoading.value.email = false;
        }
    };

    // 5. 비밀번호 변경 실행
    const performUpdatePassword = async () => {
        isLoading.value.password = true;
        try {
            await updatePassword(auth.currentUser, newPassword.value);
            toast.add({
                severity: 'success',
                summary: '성공',
                detail: '비밀번호가 변경되었습니다.',
                life: 3000,
            });
            newPassword.value = '';
        } catch (error) {
            toast.add({
                severity: 'error',
                summary: '오류',
                detail: '비밀번호 변경에 실패했습니다. (6자 이상)',
                life: 3000,
            });
        } finally {
            isLoading.value.password = false;
        }
    };

    // 6. 모든 북마크 초기화
    const handleResetBookmarks = () => {
        confirm.require({
            message:
                '모든 북마크를 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.',
            header: '북마크 초기화',
            icon: 'pi pi-exclamation-triangle',
            acceptLabel: '삭제',
            rejectLabel: '취소',
            accept: async () => {
                isLoading.value.reset = true;
                try {
                    // Firestore의 'userBookmarks' 문서 내용을 빈 배열로 덮어씁니다.
                    const userDocRef = doc(db, 'userBookmarks', user.value.uid);
                    await setDoc(userDocRef, { symbols: [] });
                    toast.add({
                        severity: 'info',
                        summary: '완료',
                        detail: '모든 북마크가 삭제되었습니다.',
                        life: 3000,
                    });
                } catch (error) {
                    toast.add({
                        severity: 'error',
                        summary: '오류',
                        detail: '초기화에 실패했습니다.',
                        life: 3000,
                    });
                } finally {
                    isLoading.value.reset = false;
                }
            },
        });
    };

    // ...
    // 7. 회원 탈퇴 실행
    const performDeleteUser = async () => {
        isLoading.value.delete = true;
        const userId = user.value.uid;
        try {
            const userDocRef = doc(db, 'userBookmarks', userId);
            await deleteDoc(userDocRef);

            // Auth에서 사용자 삭제 (이게 성공하면 onAuthStateChanged가 알아서 처리할 것임)
            await deleteUser(auth.currentUser);
        } catch (error) {
            // 실패 시에는 토스트 메시지를 보여주는 것이 유용합니다.
            toast.add({
                severity: 'error',
                summary: '오류',
                detail: '회원 탈퇴에 실패했습니다.',
                life: 3000,
            });
            console.error('회원 탈퇴 실패:', error);
        } finally {
            // isLoading 상태는 여전히 관리해주는 것이 좋습니다.
            isLoading.value.delete = false;
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
                        icon="pi pi-user"
                        severity="secondary"
                        rounded
                        disabled
                        aria-label="unlock" />
                </div>
            </template>
            <template #content>
                <div class="flex flex-column gap-3">
                    <InputGroup>
                        <InputGroupAddon>
                            <i class="pi pi-user"></i>
                        </InputGroupAddon>
                        <InputText
                            v-model="displayName"
                            placeholder="닉네임"
                            class="flex-grow" />
                        <InputGroupAddon>
                            <Button
                                label="변경"
                                @click="handleUpdateDisplayName"
                                :loading="isLoading.displayName" />
                        </InputGroupAddon>
                    </InputGroup>
                    현재 이메일: {{ user?.email }}
                    <InputGroup>
                        <InputGroupAddon> @ </InputGroupAddon>
                        <InputText
                            v-model="newEmail"
                            type="email"
                            placeholder="새 이메일 주소"
                            class="flex-grow" />
                        <InputGroupAddon>
                            <Button
                                label="변경"
                                @click="openReauthDialog('email')"
                                :loading="isLoading.email" />
                        </InputGroupAddon>
                    </InputGroup>

                    <InputGroup>
                        <InputGroupAddon>
                            <i class="pi pi-key"></i>
                        </InputGroupAddon>
                        <Password
                            v-model="newPassword"
                            placeholder="새 비밀번호 (6자 이상)"
                            :feedback="false"
                            toggleMask />
                        <InputGroupAddon>
                            <Button
                                label="변경"
                                @click="openReauthDialog('password')"
                                :loading="isLoading.password" />
                        </InputGroupAddon>
                    </InputGroup>

                    <Divider />

                    <!-- 위험 구역 -->
                    <Card class="border-red-500 border-2">
                        <template #content>
                            <div class="flex flex-column gap-2">
                                <!-- 모든 북마크 초기화 -->
                                <div
                                    class="flex flex-col gap-2 align-items-center">
                                    <span style="width: 10rem">
                                        <Button
                                            label="북마크 초기화"
                                            severity="danger"
                                            size="small"
                                            @click="handleResetBookmarks"
                                            class="w-full"
                                            :loading="isLoading.reset" />
                                    </span>
                                    <p
                                        class="text-sm text-surface-500 dark:text-surface-400">
                                        현재 "내 종목"에 추가된 모든 북마크를
                                        영구적으로 삭제합니다.
                                    </p>
                                </div>
                                <hr class="border-red-500 my-2" />
                                <!-- 회원 탈퇴 -->
                                <div
                                    class="flex flex-col gap-2 align-items-center">
                                    <span style="width: 10rem">
                                        <Button
                                            label="회원 탈퇴"
                                            severity="danger"
                                            size="small"
                                            @click="openReauthDialog('delete')"
                                            class="w-full"
                                            :loading="isLoading.delete" />
                                    </span>
                                    <p
                                        class="text-sm text-surface-500 dark:text-surface-400">
                                        계정과 관련된 모든 데이터를 영구적으로
                                        삭제합니다. 이 작업은 되돌릴 수
                                        없습니다.
                                    </p>
                                </div>
                            </div>
                        </template>
                    </Card>
                </div>
            </template>
        </Card>

        <!-- 재인증 팝업(Dialog) -->
        <Dialog
            v-model:visible="isReauthDialogVisible"
            modal
            header="비밀번호 확인"
            :style="{ width: '20rem' }">
            <p class="mb-4">
                계정 보호를 위해 현재 비밀번호를 다시 한번 입력해주세요.
            </p>
            <InputGroup>
                <InputGroupAddon>
                    <i class="pi pi-key"></i>
                </InputGroupAddon>
                <Password
                    v-model="currentPassword"
                    placeholder="현재 비밀번호"
                    toggleMask
                    :feedback="false"
                    @keyup.enter="executeReauth" />
            </InputGroup>
            <template #footer>
                <Button
                    label="취소"
                    severity="secondary"
                    @click="isReauthDialogVisible = false" />
                <Button label="확인" @click="executeReauth" />
            </template>
        </Dialog>
    </div>
</template>
