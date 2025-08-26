<!-- /components\mypage\ProfileSettings.vue -->
<script setup>
    import { ref, onMounted, onUnmounted } from 'vue';
    import { useHead } from '@vueuse/head';

    import { useRouter } from 'vue-router';
    import { auth, db, signOut } from '@/firebase';
    import { isRecentlyAuthenticated, user } from '@/store/auth';
    import {
        updatePassword,
        deleteUser,
        EmailAuthProvider,
        reauthenticateWithCredential,
    } from 'firebase/auth';
    import { doc, setDoc, deleteDoc } from 'firebase/firestore';

    // PrimeVue 컴포넌트 import
    import Card from 'primevue/card';
    import Button from 'primevue/button';
    import InputText from 'primevue/inputtext';
    import Password from 'primevue/password';
    import Dialog from 'primevue/dialog';
    import Message from 'primevue/message';
    import InputGroup from 'primevue/inputgroup';
    import InputGroupAddon from 'primevue/inputgroupaddon';
    import Divider from 'primevue/divider';
    import { useToast } from 'primevue/usetoast';
    import { useConfirm } from 'primevue/useconfirm';

    const router = useRouter();
    const toast = useToast();
    const confirm = useConfirm();

    useHead({
        title: '회원정보 수정',
    });
    // --- 상태 변수 정의 ---

    // 폼 입력값
    const displayName = ref('');
    const currentPassword = ref(''); // 사전 인증용 비밀번호
    const newPassword = ref('');
    // const newEmail = ref(''); // 제거

    // 로딩 상태
    const isLoading = ref({
        auth: false,
        displayName: false,
        // email: false, // 제거
        password: false,
        reset: false,
        delete: false,
    });

    // 에러 메시지
    const authError = ref('');

    // 회원 탈퇴 확인용 Dialog
    const isDeleteConfirmDialogVisible = ref(false);
    const deleteConfirmPassword = ref('');

    // --- 라이프사이클 훅 ---
    onMounted(() => {
        displayName.value = user.value?.displayName || '';
        isRecentlyAuthenticated.value = false;
    });

    onUnmounted(() => {
        isRecentlyAuthenticated.value = false;
    });

    // --- 함수 정의 ---

    // 1. 사전 인증 처리
    const handleReauth = async () => {
        if (!currentPassword.value) {
            authError.value = '비밀번호를 입력해주세요.';
            return;
        }
        authError.value = '';
        isLoading.value.auth = true;
        const credential = EmailAuthProvider.credential(
            user.value.email,
            currentPassword.value
        );
        try {
            await reauthenticateWithCredential(auth.currentUser, credential);
            isRecentlyAuthenticated.value = true;
        } catch (error) {
            authError.value = '비밀번호가 올바르지 않습니다.';
        } finally {
            isLoading.value.auth = false;
            currentPassword.value = '';
        }
    };

    // 2. 닉네임 변경
    // const handleUpdateDisplayName = async () => {
    //     // ... 기존 닉네임 변경 로직 (변경 없음)
    //     if (!displayName.value.trim()) {
    //         toast.add({
    //             severity: 'warn',
    //             summary: '경고',
    //             detail: '닉네임을 입력해주세요.',
    //             life: 3000,
    //         });
    //         return;
    //     }
    //     isLoading.value.displayName = true;
    //     try {
    //         await updateProfile(auth.currentUser, {
    //             displayName: displayName.value,
    //         });
    //         if (user.value) user.value.displayName = displayName.value;
    //         toast.add({
    //             severity: 'success',
    //             summary: '성공',
    //             detail: '닉네임이 변경되었습니다.',
    //             life: 3000,
    //         });
    //     } catch (error) {
    //         toast.add({
    //             severity: 'error',
    //             summary: '오류',
    //             detail: '닉네임 변경에 실패했습니다.',
    //             life: 3000,
    //         });
    //     } finally {
    //         isLoading.value.displayName = false;
    //     }
    // };

    // --- 이메일 변경 관련 함수 performUpdateEmail, handleEmailChangeRequest 모두 제거 ---

    // 3. 비밀번호 변경 실행 (기존 5번 -> 3번)
    const performUpdatePassword = async () => {
        // ... 기존 비밀번호 변경 로직 (변경 없음)
        if (!newPassword.value || newPassword.value.length < 6) {
            toast.add({
                severity: 'warn',
                summary: '경고',
                detail: '새 비밀번호는 6자 이상이어야 합니다.',
                life: 3000,
            });
            return;
        }
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
                detail: '비밀번호 변경에 실패했습니다.',
                life: 3000,
            });
        } finally {
            isLoading.value.password = false;
        }
    };

    // 4. 북마크 초기화
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
                    const userDocRef = doc(db, 'userBookmarks', user.value.uid);
                    // *** 핵심 수정: 빈 객체로 덮어씁니다. ***
                    await setDoc(userDocRef, { bookmarks: {} });
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

    // 5. 회원 탈퇴
    const handleDeleteUserRequest = () => {
        isDeleteConfirmDialogVisible.value = true;
        deleteConfirmPassword.value = '';
    };

    const performDeleteUser = async () => {
        const credential = EmailAuthProvider.credential(
            user.value.email,
            deleteConfirmPassword.value
        );
        isLoading.value.delete = true;
        try {
            // 탈퇴 전 재인증
            await reauthenticateWithCredential(auth.currentUser, credential);

            const userId = user.value.uid;
            const userDocRef = doc(db, 'userBookmarks', userId);
            await deleteDoc(userDocRef);
            await deleteUser(auth.currentUser);

            isDeleteConfirmDialogVisible.value = false;
            // onAuthStateChanged가 로그아웃 후 처리를 담당
        } catch (error) {
            toast.add({
                severity: 'error',
                summary: '인증 실패',
                detail: '비밀번호가 올바르지 않습니다.',
                life: 3000,
            });
        } finally {
            isLoading.value.delete = false;
        }
    };
</script>

<template>
    <div id="t-profile-settings">
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
                    <!-- 닉네임 설정 -->
                    <!-- <InputGroup>
                        <InputGroupAddon>
                            <i class="pi pi-user" />
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
                    </InputGroup> -->
                    <InputGroup>
                        <InputGroupAddon>@</InputGroupAddon>
                        <InputText
                            type="email"
                            :value="user?.email"
                            disabled
                            class="flex-grow" />
                    </InputGroup>

                    <!-- 인증 전 UI -->
                    <div
                        v-if="!isRecentlyAuthenticated"
                        class="flex flex-column gap-3">
                        <InputGroup>
                            <InputGroupAddon>
                                <i class="pi pi-key" />
                            </InputGroupAddon>
                            <Password
                                v-model="currentPassword"
                                placeholder="현재 비밀번호"
                                :feedback="false"
                                toggleMask
                                @keyup.enter="handleReauth" />
                            <InputGroupAddon>
                                <Button
                                    label="인증"
                                    @click="handleReauth"
                                    :loading="isLoading.auth" />
                            </InputGroupAddon>
                        </InputGroup>
                        <Message
                            v-if="authError"
                            severity="error"
                            :closable="false"
                            >{{ authError }}</Message
                        >
                        <Message severity="info" :closable="false">
                            정보 변경 및 탈퇴를 위해 비밀번호 인증이 필요합니다.
                        </Message>
                    </div>

                    <!-- 인증 후 UI -->
                    <div v-else class="flex flex-column gap-3">
                        <Message severity="success" :closable="false"
                            >인증되었습니다. 이제 정보를 변경할 수
                            있습니다.</Message
                        >
                        <Divider />

                        <!-- 비밀번호 변경 -->
                        <InputGroup>
                            <InputGroupAddon
                                ><i class="pi pi-key"></i
                            ></InputGroupAddon>
                            <Password
                                v-model="newPassword"
                                placeholder="새 비밀번호 (6자 이상)"
                                :feedback="false"
                                toggleMask />
                            <InputGroupAddon>
                                <Button
                                    label="변경"
                                    @click="performUpdatePassword"
                                    :loading="isLoading.password" />
                            </InputGroupAddon>
                        </InputGroup>

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
                                            모든 데이터를 영구적으로 초기화
                                            합니다.
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
                                                @click="handleDeleteUserRequest"
                                                class="w-full"
                                                :loading="isLoading.delete" />
                                        </span>
                                        <p
                                            class="text-sm text-surface-500 dark:text-surface-400">
                                            계정과 모든 데이터를 삭제합니다.
                                        </p>
                                    </div>
                                </div>
                            </template>
                        </Card>
                    </div>
                </div>
            </template>
        </Card>

        <!-- 회원 탈퇴 확인 Dialog -->
        <Dialog
            v-model:visible="isDeleteConfirmDialogVisible"
            modal
            header="회원 탈퇴"
            :style="{ width: '25rem' }">
            <p class="mb-4">
                정말로 탈퇴하시겠습니까? 계정을 보호하기 위해 비밀번호를 다시
                한번 입력해주세요.
            </p>
            <InputGroup>
                <InputGroupAddon><i class="pi pi-key"></i></InputGroupAddon>
                <Password
                    v-model="deleteConfirmPassword"
                    placeholder="현재 비밀번호"
                    class="w-full"
                    :feedback="false"
                    toggleMask
                    @keyup.enter="performDeleteUser" />
            </InputGroup>
            <template #footer>
                <Button
                    label="취소"
                    severity="secondary"
                    @click="isDeleteConfirmDialogVisible = false" />
                <Button
                    label="탈퇴 확인"
                    severity="danger"
                    @click="performDeleteUser"
                    :loading="isLoading.delete" />
            </template>
        </Dialog>
    </div>
</template>
