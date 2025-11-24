<!-- src/pages/AdminView.vue -->
<script setup>
    import { ref, onMounted } from 'vue';
    import { useHead } from '@vueuse/head';
    import { collection, getDocs } from 'firebase/firestore';
    import { db } from '@/firebase';
    import { useAdmin } from '@/composables/useAdmin';
    import {
        useKoNameApprovals,
        approveKoName,
        rejectKoName,
    } from '@/composables/useAssetAdmin';
    import { useToast } from 'primevue/usetoast';
    import { useRouter } from 'vue-router';

    import Card from 'primevue/card';
    import Button from 'primevue/button';
    import DataTable from 'primevue/datatable';
    import Column from 'primevue/column';
    import Tag from 'primevue/tag';
    import ProgressSpinner from 'primevue/progressspinner';
    import Message from 'primevue/message';

    useHead({ title: '관리자 - koName 승인' });

    const router = useRouter();
    const toast = useToast();
    const { isAdmin } = useAdmin();
    const { pendingApprovals, isLoading, loadPendingApprovals } =
        useKoNameApprovals();

    // 관리자 체크는 라우터 가드에서 처리됨

    const handleApprove = async (approval) => {
        try {
            await approveKoName(
                approval.userId,
                approval.memberId,
                approval.brokerageId,
                approval.accountId,
                approval.id,
                approval.koName,
                approval.symbol
            );

            toast.add({
                severity: 'success',
                summary: '승인 완료',
                detail: `${approval.koName}이(가) 승인되었습니다.`,
                life: 3000,
            });

            await loadPendingApprovals();
        } catch (error) {
            console.error('승인 실패:', error);
            toast.add({
                severity: 'error',
                summary: '오류',
                detail: '승인 처리에 실패했습니다.',
                life: 3000,
            });
        }
    };

    const handleReject = async (approval) => {
        try {
            await rejectKoName(
                approval.userId,
                approval.memberId,
                approval.brokerageId,
                approval.accountId,
                approval.id
            );

            toast.add({
                severity: 'info',
                summary: '거부 완료',
                detail: `${approval.koName}이(가) 거부되었습니다.`,
                life: 3000,
            });

            await loadPendingApprovals();
        } catch (error) {
            console.error('거부 실패:', error);
            toast.add({
                severity: 'error',
                summary: '오류',
                detail: '거부 처리에 실패했습니다.',
                life: 3000,
            });
        }
    };

    const exportMappings = async () => {
        try {
            const querySnapshot = await getDocs(
                collection(db, 'stockMappings')
            );
            const mappings = [];
            querySnapshot.forEach((doc) => {
                mappings.push(doc.data());
            });

            const dataStr =
                'data:text/json;charset=utf-8,' +
                encodeURIComponent(JSON.stringify(mappings, null, 4));
            const downloadAnchorNode = document.createElement('a');
            downloadAnchorNode.setAttribute('href', dataStr);
            downloadAnchorNode.setAttribute('download', 'mappings.json');
            document.body.appendChild(downloadAnchorNode); // required for firefox
            downloadAnchorNode.click();
            downloadAnchorNode.remove();

            toast.add({
                severity: 'success',
                summary: '내보내기 완료',
                detail: '매핑 데이터가 다운로드되었습니다.',
                life: 3000,
            });
        } catch (error) {
            console.error('내보내기 실패:', error);
            toast.add({
                severity: 'error',
                summary: '오류',
                detail: '데이터 내보내기에 실패했습니다.',
                life: 3000,
            });
        }
    };

    onMounted(async () => {
        if (isAdmin.value) {
            try {
                await loadPendingApprovals();
            } catch (error) {
                console.error('관리자 페이지 로드 실패:', error);
                toast.add({
                    severity: 'error',
                    summary: '오류',
                    detail: `승인 대기 목록을 불러오는데 실패했습니다: ${error.message}`,
                    life: 5000,
                });
            }
        }
    });
</script>

<template>
    <div id="t-admin-view">
        <Card>
            <template #header>
                <div
                    class="flex justify-content-between align-items-center p-3">
                    <h2 class="m-0">koName 승인 관리</h2>
                    <div class="flex gap-2">
                        <Button
                            label="매핑 데이터 내보내기"
                            icon="pi pi-download"
                            severity="secondary"
                            @click="exportMappings" />
                        <Button
                            label="새로고침"
                            icon="pi pi-refresh"
                            @click="loadPendingApprovals" />
                    </div>
                </div>
            </template>
            <template #content>
                <div v-if="isLoading" class="flex justify-content-center p-4">
                    <ProgressSpinner />
                </div>

                <Message
                    v-else-if="pendingApprovals.length === 0"
                    severity="info"
                    :closable="false">
                    승인 대기 중인 koName이 없습니다.
                </Message>

                <DataTable
                    v-else
                    :value="pendingApprovals"
                    :paginator="true"
                    :rows="20"
                    :rowsPerPageOptions="[10, 20, 50]"
                    responsiveLayout="scroll">
                    <Column field="isin" header="ISIN" sortable>
                        <template #body="{ data }">
                            <code>{{ data.isin }}</code>
                        </template>
                    </Column>
                    <Column field="symbol" header="SYMBOL" sortable>
                        <template #body="{ data }">
                            <InputText
                                v-model="data.symbol"
                                class="p-inputtext-sm w-full"
                                placeholder="티커 입력" />
                        </template>
                    </Column>
                    <Column field="koName" header="한국어 종목명" sortable>
                        <template #body="{ data }">
                            <strong>{{ data.koName }}</strong>
                        </template>
                    </Column>
                    <Column field="amount" header="수량" sortable>
                        <template #body="{ data }">
                            {{ data.amount?.toLocaleString() || 0 }}
                        </template>
                    </Column>
                    <Column field="currency" header="통화" sortable />
                    <Column field="userId" header="사용자 ID">
                        <template #body="{ data }">
                            <code class="text-xs"
                                >{{ data.userId.substring(0, 8) }}...</code
                            >
                        </template>
                    </Column>
                    <Column header="액션" style="width: 200px">
                        <template #body="{ data }">
                            <div class="flex gap-2">
                                <Button
                                    label="승인"
                                    icon="pi pi-check"
                                    severity="success"
                                    size="small"
                                    @click="handleApprove(data)" />
                                <Button
                                    label="거부"
                                    icon="pi pi-times"
                                    severity="danger"
                                    size="small"
                                    @click="handleReject(data)" />
                            </div>
                        </template>
                    </Column>
                </DataTable>
            </template>
        </Card>
    </div>
</template>

<style scoped>
    code {
        font-family: 'Courier New', monospace;
        background-color: var(--surface-100);
        padding: 2px 6px;
        border-radius: 4px;
    }
</style>
