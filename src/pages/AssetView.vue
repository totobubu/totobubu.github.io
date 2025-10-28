<!-- src/pages/AssetView.vue -->
<script setup>
    import { ref, computed, onMounted, watch } from 'vue';
    import { useHead } from '@vueuse/head';
    import { useRouter, useRoute } from 'vue-router';
    import { user } from '@/store/auth';
    import {
        useFamilyMembers,
        useBrokerages,
        useAccounts,
        useAssets,
    } from '@/composables/useAssetFirestore';
    import { useToast } from 'primevue/usetoast';
    import { useConfirm } from 'primevue/useconfirm';
    import ConfirmDialog from 'primevue/confirmdialog';
    import Toast from 'primevue/toast';

    import Card from 'primevue/card';
    import Button from 'primevue/button';
    import InputText from 'primevue/inputtext';
    import Dialog from 'primevue/dialog';
    import Dropdown from 'primevue/dropdown';
    import InputNumber from 'primevue/inputnumber';
    import Textarea from 'primevue/textarea';
    import Tag from 'primevue/tag';
    import Avatar from 'primevue/avatar';
    import TreeTable from 'primevue/treetable';
    import Column from 'primevue/column';
    import FileUpload from 'primevue/fileupload';

    // Components
    import FamilyMemberList from '@/components/asset/FamilyMemberList.vue';
    import AssetViewModeToggle from '@/components/asset/AssetViewModeToggle.vue';
    import AssetListView from '@/components/asset/AssetListView.vue';
    import AddAssetModal from '@/components/asset/AddAssetModal.vue';

    useHead({ title: '자산관리' });

    const toast = useToast();
    const confirm = useConfirm();
    const router = useRouter();
    const route = useRoute();

    const familyMembersComposable = useFamilyMembers();
    const familyMembers = familyMembersComposable.familyMembers;
    const isLoadingMembers = familyMembersComposable.isLoading;
    const loadFamilyMembers = familyMembersComposable.loadFamilyMembers;
    const addFamilyMember = familyMembersComposable.addFamilyMember;
    const updateFamilyMember = familyMembersComposable.updateFamilyMember;
    const deleteFamilyMember = familyMembersComposable.deleteFamilyMember;

    const { loadBrokerages, addBrokerage, updateBrokerage, deleteBrokerage } =
        useBrokerages();

    const { loadAccounts, addAccount, updateAccount, deleteAccount } =
        useAccounts();

    const { loadAssets, addAsset, updateAsset, deleteAsset } = useAssets();

    // 선택된 탭
    const selectedTabIndex = ref('0');

    // View 모드 (증권사/계좌 기준 vs 종목 기준)
    const viewMode = ref('account');

    // 현재 선택된 멤버
    const selectedMember = computed(() => {
        const index = parseInt(selectedTabIndex.value);
        if (index >= familyMembers.value.length) return null;
        return familyMembers.value[index] || null;
    });

    // 다이얼로그 상태
    const showMemberDialog = ref(false);
    const showBrokerageDialog = ref(false);
    const showAccountDialog = ref(false);
    const showAssetDialog = ref(false);
    const showUploadDialog = ref(false);

    // 업로드 대상 자산
    const uploadTargetAsset = ref(null);

    // 폼 데이터
    const memberForm = ref({ name: '', relationship: '본인' });
    const brokerageForm = ref({ name: '' });
    const accountForm = ref({ name: '', accountNumber: '' });
    const assetForm = ref({
        type: '주식',
        symbol: '',
        amount: 0,
        currency: 'KRW',
        notes: '',
    });

    // 편집 모드
    const editMode = ref({
        member: null,
        brokerage: null,
        account: null,
        asset: null,
    });

    // 선택된 노드
    const selectedNode = ref(null);

    // 관계 옵션
    const relationships = [
        { label: '본인', value: '본인' },
        { label: '배우자', value: '배우자' },
        { label: '자녀', value: '자녀' },
        { label: '부모', value: '부모' },
        { label: '기타', value: '기타' },
    ];

    // 자산 종류 옵션
    const assetTypes = [
        { label: '주식', value: '주식' },
        { label: '현금', value: '현금' },
        { label: '외환예금', value: '외환예금' },
        { label: '코인', value: '코인' },
    ];

    // 통화 옵션
    const currencies = [
        { label: 'KRW', value: 'KRW' },
        { label: 'USD', value: 'USD' },
        { label: 'EUR', value: 'EUR' },
        { label: 'JPY', value: 'JPY' },
    ];

    // 관계별 색상
    const getRelationshipColor = (relationship) => {
        const colors = {
            본인: 'success',
            배우자: 'warning',
            자녀: 'info',
            부모: 'help',
            기타: 'secondary',
        };
        return colors[relationship] || 'secondary';
    };

    // 로드된 데이터 캐시
    const loadedMemberData = ref({});

    // 선택된 멤버 감시
    watch(selectedMember, (member) => {
        if (member) {
            router.push({ query: { memberId: member.id } });
        }
    });

    // 트리 데이터 생성
    const createTreeData = (memberId) => {
        const data = loadedMemberData.value[memberId];
        if (!data) return [];

        const tree = [];
        data.brokerages.forEach((brokerage) => {
            const brokerageNode = {
                key: brokerage.id,
                data: {
                    id: brokerage.id,
                    name: brokerage.name,
                    type: '증권사',
                    icon: 'pi pi-building',
                },
                children: [],
            };

            const accounts = data.accounts.filter(
                (acc) => acc.brokerageId === brokerage.id
            );
            accounts.forEach((account) => {
                const accountNode = {
                    key: account.id,
                    data: {
                        id: account.id,
                        name: account.name,
                        accountNumber: account.accountNumber,
                        brokerageId: brokerage.id,
                        type: '계좌',
                        icon: 'pi pi-wallet',
                    },
                    children: [],
                };

                const assets = data.assets.filter(
                    (ast) => ast.accountId === account.id
                );
                assets.forEach((asset) => {
                    accountNode.children.push({
                        key: asset.id,
                        data: {
                            id: asset.id,
                            name: `${asset.type}${asset.symbol ? ': ' + asset.symbol : ''} - ${asset.amount} ${asset.currency}`,
                            ...asset,
                            brokerageId: brokerage.id,
                            accountId: account.id,
                            type: '자산',
                            icon: getAssetTypeIcon(asset.type),
                        },
                    });
                });

                brokerageNode.children.push(accountNode);
            });

            tree.push(brokerageNode);
        });

        return tree;
    };

    // 트리 데이터 맵
    const treeDataMap = computed(() => {
        const map = {};
        familyMembers.value.forEach((member) => {
            map[member.id] = createTreeData(member.id);
        });
        return map;
    });

    // 멤버 데이터 로드
    const loadMemberData = async (memberId) => {
        if (loadedMemberData.value[memberId]) return;

        const brokerages = await loadBrokerages(user.value.uid, memberId);
        const accounts = [];
        const assets = [];

        for (const brokerage of brokerages) {
            const accs = await loadAccounts(
                user.value.uid,
                memberId,
                brokerage.id
            );
            for (const account of accs) {
                accounts.push({ ...account, brokerageId: brokerage.id });
                const ass = await loadAssets(
                    user.value.uid,
                    memberId,
                    brokerage.id,
                    account.id
                );
                assets.push(...ass);
            }
        }

        loadedMemberData.value[memberId] = {
            brokerages,
            accounts,
            assets,
        };
    };

    onMounted(async () => {
        console.log('🔵 AssetView mounted, user:', user.value);
        if (user.value) {
            console.log('🟡 Loading family members for user:', user.value.uid);
            await loadFamilyMembers(user.value.uid);
            console.log('🟢 Loaded family members:', familyMembers.value);
            console.log('🟢 familyMembers.length:', familyMembers.value.length);

            if (familyMembers.value.length > 0) {
                console.log(
                    '🟢 Loading data for first member:',
                    familyMembers.value[0].id
                );
                await loadMemberData(familyMembers.value[0].id);
            } else {
                console.log('⚠️ No family members found');
            }
        } else {
            console.log('❌ No user logged in');
        }
    });

    // 탭 변경 처리
    const handleTabChange = async (newIndex) => {
        console.log('handleTabChange called with:', newIndex);
        selectedTabIndex.value = String(newIndex);
        const index = parseInt(newIndex);

        // "가족 추가" 탭이 아닌 경우에만 데이터 로드
        if (index < familyMembers.value.length) {
            const memberId = familyMembers.value[index]?.id;
            console.log('Loading data for member:', memberId);
            if (memberId) {
                await loadMemberData(memberId);
            }
        }
    };

    // 가족 멤버 관련
    const openAddMemberDialog = () => {
        memberForm.value = { name: '', relationship: '본인' };
        editMode.value.member = null;
        showMemberDialog.value = true;
    };

    const saveMember = async () => {
        if (!memberForm.value.name) {
            toast.add({
                severity: 'warn',
                summary: '경고',
                detail: '이름을 입력해주세요.',
                life: 3000,
            });
            return;
        }

        try {
            if (editMode.value.member) {
                await updateFamilyMember(
                    user.value.uid,
                    editMode.value.member.id,
                    memberForm.value
                );
                toast.add({
                    severity: 'success',
                    summary: '성공',
                    detail: '가족 멤버가 수정되었습니다.',
                    life: 3000,
                });
            } else {
                await addFamilyMember(user.value.uid, memberForm.value);
                toast.add({
                    severity: 'success',
                    summary: '성공',
                    detail: '가족 멤버가 추가되었습니다.',
                    life: 3000,
                });
            }
            await loadFamilyMembers(user.value.uid);
            showMemberDialog.value = false;
        } catch (error) {
            console.error('saveMember error:', error);
            toast.add({
                severity: 'error',
                summary: '오류',
                detail: '저장에 실패했습니다.',
                life: 3000,
            });
        }
    };

    const removeMember = (member) => {
        confirm.require({
            message: `${member.name}님의 모든 데이터를 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.`,
            header: '가족 멤버 삭제',
            icon: 'pi pi-exclamation-triangle',
            acceptLabel: '삭제',
            rejectLabel: '취소',
            accept: async () => {
                try {
                    await deleteFamilyMember(user.value.uid, member.id);
                    delete loadedMemberData.value[member.id];
                    await loadFamilyMembers(user.value.uid);
                    if (
                        parseInt(selectedTabIndex.value) >=
                        familyMembers.value.length
                    ) {
                        selectedTabIndex.value = String(
                            Math.max(0, familyMembers.value.length - 1)
                        );
                    }
                    toast.add({
                        severity: 'info',
                        summary: '완료',
                        detail: '가족 멤버가 삭제되었습니다.',
                        life: 3000,
                    });
                } catch (error) {
                    console.error('removeMember error:', error);
                    toast.add({
                        severity: 'error',
                        summary: '오류',
                        detail: '삭제에 실패했습니다.',
                        life: 3000,
                    });
                }
            },
        });
    };

    const getAssetTypeIcon = (type) => {
        const icons = {
            주식: 'pi pi-chart-line',
            현금: 'pi pi-money-bill',
            외환예금: 'pi pi-dollar',
            코인: 'pi pi-bitcoin',
        };
        return icons[type] || 'pi pi-circle';
    };

    const formatCurrency = (amount, currency) => {
        return new Intl.NumberFormat('ko-KR', {
            style: 'currency',
            currency: currency || 'KRW',
        }).format(amount);
    };

    const onRowSelect = (event) => {
        selectedNode.value = event.node;
    };

    const editNode = (node) => {
        const data = node.data;
        const memberId = selectedMember.value?.id;
        if (!memberId) return;

        if (data.type === '자산') {
            const asset = loadedMemberData.value[memberId]?.assets.find(
                (a) => a.id === data.id
            );
            if (asset) {
                openEditAssetDialog(
                    memberId,
                    data.brokerageId,
                    data.accountId,
                    asset
                );
            }
        }
    };

    const deleteNode = (node) => {
        confirm.require({
            message: `${node.data.name}을(를) 삭제하시겠습니까?`,
            header: '삭제 확인',
            icon: 'pi pi-exclamation-triangle',
            acceptLabel: '삭제',
            rejectLabel: '취소',
            accept: async () => {
                const data = node.data;
                const memberId = selectedMember.value?.id;
                if (!memberId) return;

                if (data.type === '증권사') {
                    await deleteBrokerage(user.value.uid, memberId, data.id);
                } else if (data.type === '계좌') {
                    await deleteAccount(
                        user.value.uid,
                        memberId,
                        data.brokerageId,
                        data.id
                    );
                } else if (data.type === '자산') {
                    await deleteAsset(
                        user.value.uid,
                        memberId,
                        data.brokerageId,
                        data.accountId,
                        data.id
                    );
                }

                delete loadedMemberData.value[memberId];
                await loadMemberData(memberId);
            },
        });
    };

    const addChild = (node) => {
        const data = node.data;
        const memberId = selectedMember.value?.id;
        if (!memberId) return;

        if (data.type === '증권사') {
            openAddAccountDialog(memberId, data.id);
        } else if (data.type === '계좌') {
            // 기존 Dialog 대신 AddAssetModal 사용
            openAddAssetModalFromTree(memberId, data.brokerageId, data.id);
        }
    };

    // 업로드 다이얼로그 열기
    const openUploadDialog = (node) => {
        uploadTargetAsset.value = node;
        showUploadDialog.value = true;
    };

    // 파일 업로드 처리
    const handleFileUpload = async (event) => {
        const files = event.files;
        if (!files || files.length === 0) return;

        console.log('파일 업로드:', files);

        // TODO: PDF/Excel 파싱 로직 구현
        // 현재는 파일명과 형식만 확인
        for (const file of files) {
            console.log(
                `파일명: ${file.name}, 크기: ${file.size}, 형식: ${file.type}`
            );
        }

        toast.add({
            severity: 'info',
            summary: '업로드 완료',
            detail: `${files.length}개의 파일이 업로드되었습니다. (파싱 기능은 개발 중입니다)`,
            life: 3000,
        });
    };

    // 증권사 관련
    const openAddBrokerageDialog = (memberId) => {
        brokerageForm.value = { name: '' };
        editMode.value.brokerage = null;
        showBrokerageDialog.value = true;
    };

    const saveBrokerage = async () => {
        if (!brokerageForm.value.name) {
            toast.add({
                severity: 'warn',
                summary: '경고',
                detail: '증권사 이름을 입력해주세요.',
                life: 3000,
            });
            return;
        }

        const memberId = selectedMember.value.id;

        try {
            if (editMode.value.brokerage) {
                await updateBrokerage(
                    user.value.uid,
                    memberId,
                    editMode.value.brokerage.id,
                    brokerageForm.value
                );
                toast.add({
                    severity: 'success',
                    summary: '성공',
                    detail: '증권사가 수정되었습니다.',
                    life: 3000,
                });
            } else {
                await addBrokerage(
                    user.value.uid,
                    memberId,
                    brokerageForm.value
                );
                toast.add({
                    severity: 'success',
                    summary: '성공',
                    detail: '증권사가 추가되었습니다.',
                    life: 3000,
                });
            }
            delete loadedMemberData.value[memberId];
            await loadMemberData(memberId);
            showBrokerageDialog.value = false;
        } catch (error) {
            console.error('saveBrokerage error:', error);
            toast.add({
                severity: 'error',
                summary: '오류',
                detail: '저장에 실패했습니다.',
                life: 3000,
            });
        }
    };

    const removeBrokerage = (memberId, brokerageId) => {
        confirm.require({
            message:
                '이 증권사의 모든 계좌와 자산이 삭제됩니다. 계속하시겠습니까?',
            header: '증권사 삭제',
            icon: 'pi pi-exclamation-triangle',
            acceptLabel: '삭제',
            rejectLabel: '취소',
            accept: async () => {
                await deleteBrokerage(user.value.uid, memberId, brokerageId);
                delete loadedMemberData.value[memberId];
                await loadMemberData(memberId);
            },
        });
    };

    // 계좌 관련
    const openAddAccountDialog = (memberId, brokerageId) => {
        accountForm.value = { name: '', accountNumber: '' };
        editMode.value.account = null;
        selectedNode.value = { data: { brokerageId } };
        showAccountDialog.value = true;
    };

    const saveAccount = async () => {
        if (!accountForm.value.name) {
            toast.add({
                severity: 'warn',
                summary: '경고',
                detail: '계좌명을 입력해주세요.',
                life: 3000,
            });
            return;
        }

        const memberId = selectedMember.value.id;
        const brokerageId =
            editMode.value.account?.brokerageId ||
            selectedNode.value?.data.brokerageId;

        try {
            if (editMode.value.account) {
                await updateAccount(
                    user.value.uid,
                    memberId,
                    brokerageId,
                    editMode.value.account.id,
                    accountForm.value
                );
                toast.add({
                    severity: 'success',
                    summary: '성공',
                    detail: '계좌가 수정되었습니다.',
                    life: 3000,
                });
            } else {
                await addAccount(
                    user.value.uid,
                    memberId,
                    brokerageId,
                    accountForm.value
                );
                toast.add({
                    severity: 'success',
                    summary: '성공',
                    detail: '계좌가 추가되었습니다.',
                    life: 3000,
                });
            }
            delete loadedMemberData.value[memberId];
            await loadMemberData(memberId);
            showAccountDialog.value = false;
        } catch (error) {
            console.error('saveAccount error:', error);
            toast.add({
                severity: 'error',
                summary: '오류',
                detail: '저장에 실패했습니다.',
                life: 3000,
            });
        }
    };

    // AddAssetModal 상태
    const showAddAssetModal = ref(false);
    const addAssetModalTarget = ref({
        memberId: null,
        brokerageId: null,
        accountId: null,
    });

    // 자산 관련
    const openAddAssetDialog = (memberId, brokerageId, accountId) => {
        assetForm.value = {
            type: '주식',
            symbol: '',
            amount: 0,
            currency: 'KRW',
            notes: '',
        };
        editMode.value.asset = null;
        selectedNode.value = { data: { brokerageId, accountId } };
        showAssetDialog.value = true;
    };

    const openAddAssetModalFromTree = (memberId, brokerageId, accountId) => {
        addAssetModalTarget.value = { memberId, brokerageId, accountId };
        showAddAssetModal.value = true;
    };

    const handleAssetSaved = async (data) => {
        console.log('Asset saved from modal:', data);
        // TODO: Firestore에 실제로 저장하는 로직 추가
        toast.add({
            severity: 'success',
            summary: '저장 완료',
            detail: '자산이 저장되었습니다.',
            life: 3000,
        });

        // 선택된 멤버의 데이터 다시 로드
        if (addAssetModalTarget.value.memberId) {
            delete loadedMemberData.value[addAssetModalTarget.value.memberId];
            await loadMemberData(addAssetModalTarget.value.memberId);
        }
    };

    const openEditAssetDialog = (memberId, brokerageId, accountId, asset) => {
        assetForm.value = { ...asset };
        editMode.value.asset = asset;
        showAssetDialog.value = true;
    };

    const saveAsset = async () => {
        if (!assetForm.value.type) {
            toast.add({
                severity: 'warn',
                summary: '경고',
                detail: '자산 종류를 선택해주세요.',
                life: 3000,
            });
            return;
        }

        const memberId = selectedMember.value.id;
        const { brokerageId, accountId } = editMode.value.asset
            ? {
                  brokerageId: selectedNode.value.data.brokerageId,
                  accountId: selectedNode.value.data.accountId,
              }
            : {
                  brokerageId: selectedNode.value.data.brokerageId,
                  accountId: selectedNode.value.data.id,
              };

        try {
            if (editMode.value.asset) {
                await updateAsset(
                    user.value.uid,
                    memberId,
                    brokerageId,
                    accountId,
                    editMode.value.asset.id,
                    assetForm.value
                );
                toast.add({
                    severity: 'success',
                    summary: '성공',
                    detail: '자산이 수정되었습니다.',
                    life: 3000,
                });
            } else {
                await addAsset(
                    user.value.uid,
                    memberId,
                    brokerageId,
                    accountId,
                    assetForm.value
                );
                toast.add({
                    severity: 'success',
                    summary: '성공',
                    detail: '자산이 추가되었습니다.',
                    life: 3000,
                });
            }
            delete loadedMemberData.value[memberId];
            await loadMemberData(memberId);
            showAssetDialog.value = false;
        } catch (error) {
            console.error('saveAsset error:', error);
            toast.add({
                severity: 'error',
                summary: '오류',
                detail: '저장에 실패했습니다.',
                life: 3000,
            });
        }
    };
</script>

<template>
    <div id="t-asset-view">
        <!-- DEBUG: 상태 정보 -->
        <Card class="mb-3">
            <template #content>
                <div class="p-3">
                    <h4>🔍 Debug 정보</h4>
                    <p>familyMembers.length: {{ familyMembers.length }}</p>
                    <p>isLoadingMembers: {{ isLoadingMembers }}</p>
                    <p>selectedTabIndex: {{ selectedTabIndex }}</p>
                </div>
            </template>
        </Card>

        <!-- 가족 멤버가 없을 때 -->
        <Card v-if="familyMembers.length === 0 && !isLoadingMembers">
            <template #content>
                <div
                    class="flex flex-column align-items-center justify-content-center p-8 gap-4">
                    <i class="pi pi-wallet text-8xl text-surface-400"></i>
                    <h4 class="text-2xl font-bold">자산관리를 시작하세요</h4>
                    <p class="text-surface-500">
                        가족 구성원을 추가하여 자산을 체계적으로 관리할 수
                        있습니다.
                    </p>
                    <Button
                        label="첫 번째 가족 추가하기"
                        icon="pi pi-plus"
                        size="large"
                        @click="openAddMemberDialog" />
                </div>
            </template>
        </Card>

        <!-- 가족 멤버 리스트 -->
        <FamilyMemberList
            v-if="familyMembers.length > 0"
            :members="familyMembers"
            :selectedIndex="selectedTabIndex"
            @select="handleTabChange" />

        <!-- 선택된 멤버의 자산 관리 -->
        <div v-if="selectedMember" class="mt-3">
            <!-- View 모드 토글 -->
            <AssetViewModeToggle v-model:mode="viewMode" />

            <!-- 증권사 추가 버튼 -->
            <div class="flex justify-content-end mb-3">
                <Button
                    label="증권사 추가"
                    icon="pi pi-plus"
                    @click="openAddBrokerageDialog(selectedMember.id)" />
            </div>

            <!-- TreeTable 구조로 자산 관리 -->
            <Card>
                <template #header>
                    <div
                        class="flex justify-content-between align-items-center p-3">
                        <h3 class="m-0">{{ selectedMember.name }}님의 자산</h3>
                    </div>
                </template>
                <template #content>
                    <TreeTable
                        :value="treeDataMap[selectedMember.id]"
                        :metaKeySelection="false"
                        selectionMode="single"
                        @rowSelect="onRowSelect">
                        <Column field="name" header="자산" expander>
                            <template #body="{ node }">
                                <div class="flex align-items-center gap-2">
                                    <i
                                        :class="`${node.data.icon} text-primary`"></i>
                                    <span class="font-semibold">{{
                                        node.data.name
                                    }}</span>
                                    <Tag
                                        v-if="node.data.type"
                                        :value="node.data.type"
                                        severity="info" />
                                </div>
                            </template>
                        </Column>
                        <Column field="amount" header="금액">
                            <template #body="{ node }">
                                <span v-if="node.data.type === '자산'">
                                    {{
                                        formatCurrency(
                                            node.data.amount,
                                            node.data.currency
                                        )
                                    }}
                                </span>
                            </template>
                        </Column>
                        <Column header="액션" style="width: 200px">
                            <template #body="{ node }">
                                <div class="flex gap-2">
                                    <Button
                                        icon="pi pi-upload"
                                        size="small"
                                        rounded
                                        severity="info"
                                        v-tooltip="'파일 업로드'"
                                        @click="openUploadDialog(node)" />
                                    <Button
                                        icon="pi pi-plus"
                                        size="small"
                                        rounded
                                        v-tooltip="'추가'"
                                        @click="addChild(node)" />
                                    <Button
                                        icon="pi pi-pencil"
                                        size="small"
                                        rounded
                                        severity="secondary"
                                        v-tooltip="'수정'"
                                        @click="editNode(node)" />
                                    <Button
                                        icon="pi pi-trash"
                                        size="small"
                                        rounded
                                        severity="danger"
                                        v-tooltip="'삭제'"
                                        @click="deleteNode(node)" />
                                </div>
                            </template>
                        </Column>
                    </TreeTable>

                    <Card
                        v-if="
                            (treeDataMap[selectedMember.id] || []).length === 0
                        ">
                        <template #content>
                            <div
                                class="flex flex-column align-items-center gap-3 p-4">
                                <i
                                    class="pi pi-inbox text-6xl text-surface-400"></i>
                                <p class="text-surface-500">
                                    등록된 자산이 없습니다.
                                </p>
                                <Button
                                    label="첫 번째 증권사 추가하기"
                                    icon="pi pi-plus"
                                    @click="
                                        openAddBrokerageDialog(
                                            selectedMember.id
                                        )
                                    " />
                            </div>
                        </template>
                    </Card>
                </template>
            </Card>

            <!-- 종목 기준 보기 (별도 패널) -->
            <div v-if="viewMode === 'stock'" class="mt-4">
                <AssetListView
                    :viewMode="viewMode"
                    :treeData="treeDataMap[selectedMember.id] || []" />
            </div>
        </div>

        <!-- 가족 추가 패널 -->
        <div v-if="selectedTabIndex === String(familyMembers.length)">
            <Card>
                <template #content>
                    <div
                        class="flex flex-column align-items-center justify-content-center p-8 gap-4">
                        <i
                            class="pi pi-user-plus text-8xl text-surface-400"></i>
                        <h4 class="text-2xl font-bold">
                            새로운 가족을 추가하세요
                        </h4>
                        <p class="text-surface-500">
                            배우자, 자녀, 부모님 등 가족의 자산을 관리하세요.
                        </p>
                        <Button
                            label="가족 추가하기"
                            icon="pi pi-plus"
                            size="large"
                            @click="openAddMemberDialog" />
                    </div>
                </template>
            </Card>
        </div>

        <!-- 가족 멤버 다이얼로그 -->
        <Dialog
            v-model:visible="showMemberDialog"
            modal
            :style="{ width: '30rem' }">
            <template #header>
                <span class="font-bold text-lg">{{
                    editMode.member ? '가족 멤버 수정' : '가족 멤버 추가'
                }}</span>
            </template>
            <div class="flex flex-column gap-3">
                <div class="flex flex-column gap-2">
                    <label for="memberName">이름</label>
                    <InputText
                        id="memberName"
                        v-model="memberForm.name"
                        placeholder="이름을 입력하세요" />
                </div>
                <div class="flex flex-column gap-2">
                    <label for="memberRelationship">관계</label>
                    <Dropdown
                        id="memberRelationship"
                        v-model="memberForm.relationship"
                        :options="relationships"
                        optionLabel="label"
                        optionValue="value"
                        placeholder="관계를 선택하세요" />
                </div>
            </div>
            <template #footer>
                <Button
                    label="취소"
                    severity="secondary"
                    @click="showMemberDialog = false" />
                <Button label="저장" @click="saveMember" />
            </template>
        </Dialog>

        <!-- 증권사 다이얼로그 -->
        <Dialog
            v-model:visible="showBrokerageDialog"
            modal
            :style="{ width: '30rem' }">
            <template #header>
                <span class="font-bold text-lg">증권사 추가</span>
            </template>
            <div class="flex flex-column gap-3">
                <div class="flex flex-column gap-2">
                    <label for="brokerageName">증권사 이름</label>
                    <InputText
                        id="brokerageName"
                        v-model="brokerageForm.name"
                        placeholder="예: KB증권, 미래에셋" />
                </div>
            </div>
            <template #footer>
                <Button
                    label="취소"
                    severity="secondary"
                    @click="showBrokerageDialog = false" />
                <Button label="저장" @click="saveBrokerage" />
            </template>
        </Dialog>

        <!-- 계좌 다이얼로그 -->
        <Dialog
            v-model:visible="showAccountDialog"
            modal
            :style="{ width: '30rem' }">
            <template #header>
                <span class="font-bold text-lg">계좌 추가</span>
            </template>
            <div class="flex flex-column gap-3">
                <div class="flex flex-column gap-2">
                    <label for="accountName">계좌명</label>
                    <InputText
                        id="accountName"
                        v-model="accountForm.name"
                        placeholder="계좌명을 입력하세요" />
                </div>
                <div class="flex flex-column gap-2">
                    <label for="accountNumber">계좌번호 (선택)</label>
                    <InputText
                        id="accountNumber"
                        v-model="accountForm.accountNumber"
                        placeholder="계좌번호를 입력하세요" />
                </div>
            </div>
            <template #footer>
                <Button
                    label="취소"
                    severity="secondary"
                    @click="showAccountDialog = false" />
                <Button label="저장" @click="saveAccount" />
            </template>
        </Dialog>

        <!-- 자산 다이얼로그 -->
        <Dialog
            v-model:visible="showAssetDialog"
            modal
            :style="{ width: '30rem' }">
            <template #header>
                <span class="font-bold text-lg">자산 추가</span>
            </template>
            <div class="flex flex-column gap-3">
                <div class="flex flex-column gap-2">
                    <label for="assetType">자산 종류</label>
                    <Dropdown
                        id="assetType"
                        v-model="assetForm.type"
                        :options="assetTypes"
                        optionLabel="label"
                        optionValue="value"
                        placeholder="자산 종류를 선택하세요" />
                </div>
                <div
                    v-if="assetForm.type === '주식'"
                    class="flex flex-column gap-2">
                    <label for="assetSymbol">심볼</label>
                    <InputText
                        id="assetSymbol"
                        v-model="assetForm.symbol"
                        placeholder="예: AAPL, TSLA" />
                </div>
                <div class="flex flex-column gap-2">
                    <label for="assetAmount">수량/금액</label>
                    <InputNumber
                        id="assetAmount"
                        v-model="assetForm.amount"
                        :min="0"
                        placeholder="수량 또는 금액" />
                </div>
                <div class="flex flex-column gap-2">
                    <label for="assetCurrency">통화</label>
                    <Dropdown
                        id="assetCurrency"
                        v-model="assetForm.currency"
                        :options="currencies"
                        optionLabel="label"
                        optionValue="value"
                        placeholder="통화를 선택하세요" />
                </div>
                <div class="flex flex-column gap-2">
                    <label for="assetNotes">메모 (선택)</label>
                    <Textarea
                        id="assetNotes"
                        v-model="assetForm.notes"
                        rows="3"
                        placeholder="추가 정보를 입력하세요" />
                </div>
            </div>
            <template #footer>
                <Button
                    label="취소"
                    severity="secondary"
                    @click="showAssetDialog = false" />
                <Button label="저장" @click="saveAsset" />
            </template>
        </Dialog>

        <!-- 파일 업로드 다이얼로그 -->
        <Dialog
            v-model:visible="showUploadDialog"
            modal
            :style="{ width: '40rem' }"
            header="파일 업로드">
            <div class="flex flex-column gap-4">
                <div v-if="uploadTargetAsset">
                    <Tag :value="uploadTargetAsset.data.name" severity="info" />
                    <p class="text-surface-600">
                        {{ uploadTargetAsset.data.name }}에 파일을 업로드합니다.
                    </p>
                </div>

                <FileUpload
                    mode="basic"
                    name="upload[]"
                    accept=".pdf,.xlsx,.xls,.csv"
                    :maxFileSize="5000000"
                    @upload="handleFileUpload"
                    :auto="false"
                    chooseLabel="파일 선택"
                    class="w-full">
                    <template #empty>
                        <p class="text-center text-surface-500">
                            드래그하여 파일을 업로드하거나 클릭하여 선택하세요.
                        </p>
                    </template>
                </FileUpload>

                <div class="flex flex-column gap-2">
                    <h5 class="font-semibold">업로드 가능한 파일 형식:</h5>
                    <ul class="list-none pl-0">
                        <li class="flex align-items-center gap-2">
                            <i class="pi pi-file text-primary" /> 입출금 내역
                            (CSV, XLSX, PDF)
                        </li>
                        <li class="flex align-items-center gap-2">
                            <i class="pi pi-file text-primary" /> 매수/매도 내역
                            (CSV, XLSX, PDF)
                        </li>
                        <li class="flex align-items-center gap-2">
                            <i class="pi pi-file text-primary" /> 환율 정보
                            (CSV, XLSX)
                        </li>
                    </ul>
                </div>
            </div>
            <template #footer>
                <Button
                    label="취소"
                    severity="secondary"
                    @click="showUploadDialog = false" />
            </template>
        </Dialog>

        <!-- ConfirmDialog -->
        <ConfirmDialog />

        <!-- Toast -->
        <Toast />

        <!-- Add Asset Modal -->
        <AddAssetModal
            v-model:visible="showAddAssetModal"
            :showAssetType="true"
            @saved="handleAssetSaved" />
    </div>
</template>
