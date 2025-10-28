<!-- src/components/asset/AssetListView.vue -->
<script setup>
    import { computed } from 'vue';
    import Card from 'primevue/card';
    import Tag from 'primevue/tag';

    const props = defineProps({
        viewMode: {
            type: String,
            default: 'account',
        },
        treeData: {
            type: Array,
            default: () => [],
        },
    });

    const emit = defineEmits(['upload', 'addChild', 'edit', 'delete']);

    const formatCurrency = (amount, currency) => {
        return new Intl.NumberFormat('ko-KR', {
            style: 'currency',
            currency: currency || 'KRW',
        }).format(amount);
    };

    const formatNumber = (value) => {
        return new Intl.NumberFormat('ko-KR').format(value);
    };

    const getRateColor = (rate) => {
        if (rate > 0) return 'success';
        if (rate < 0) return 'danger';
        return 'secondary';
    };

    const formatRate = (rate) => {
        if (rate === undefined || rate === null) return '0.00%';
        return `${rate >= 0 ? '+' : ''}${rate.toFixed(2)}%`;
    };

    // 증권사/계좌 기준 보기
    const accountViewData = computed(() => {
        // treeData를 그대로 사용 (증권사 > 계좌 > 자산 구조)
        return props.treeData;
    });

    // 종목 기준 보기
    const stockViewData = computed(() => {
        if (!props.treeData || props.treeData.length === 0) return [];

        // 모든 자산을 추출하고 종목별로 그룹화
        const stocks = {};

        props.treeData.forEach((brokerage) => {
            brokerage.children?.forEach((account) => {
                account.children?.forEach((asset) => {
                    const symbol = asset.data.symbol || asset.data.name;
                    if (!stocks[symbol]) {
                        stocks[symbol] = {
                            symbol: symbol,
                            type: asset.data.type,
                            name: asset.data.name,
                            totalAmount: asset.data.amount || 0,
                            totalQuantity: 1,
                            currency: asset.data.currency || 'KRW',
                            avgPrice: asset.data.amount || 0,
                            accounts: [],
                        };
                    } else {
                        stocks[symbol].totalAmount += asset.data.amount || 0;
                        stocks[symbol].totalQuantity += 1;
                        stocks[symbol].avgPrice =
                            stocks[symbol].totalAmount /
                            stocks[symbol].totalQuantity;
                    }

                    stocks[symbol].accounts.push({
                        brokerage: brokerage.data.name,
                        account: account.data.name,
                        amount: asset.data.amount || 0,
                        quantity: 1,
                    });
                });
            });
        });

        return Object.values(stocks);
    });

    const displayData = computed(() => {
        return props.viewMode === 'account'
            ? accountViewData.value
            : stockViewData.value;
    });
</script>

<template>
    <div>
        <!-- 증권사/계좌 기준 보기 -->
        <div v-if="viewMode === 'account'">
            <div
                v-for="brokerage in treeData"
                :key="brokerage.key"
                class="mb-4">
                <Card>
                    <template #header>
                        <div class="flex align-items-center gap-2 p-3">
                            <i
                                :class="`${brokerage.data.icon} text-primary text-xl`"></i>
                            <h3 class="m-0">{{ brokerage.data.name }}</h3>
                        </div>
                    </template>
                    <template #content>
                        <div class="flex flex-column gap-3">
                            <div
                                v-for="account in brokerage.children"
                                :key="account.key">
                                <div
                                    class="flex align-items-center gap-2 p-2 border-bottom-1 surface-border">
                                    <i
                                        :class="`${account.data.icon} text-primary`"></i>
                                    <span class="font-semibold">{{
                                        account.data.name
                                    }}</span>
                                    <Tag value="계좌" severity="info" />
                                </div>
                                <div
                                    v-if="
                                        account.children &&
                                        account.children.length > 0
                                    "
                                    class="p-4 pl-6">
                                    <table class="w-full">
                                        <thead>
                                            <tr
                                                class="text-sm text-surface-500 border-bottom-1">
                                                <th class="text-left p-2">
                                                    자산
                                                </th>
                                                <th class="text-right p-2">
                                                    평가액
                                                </th>
                                                <th class="text-right p-2">
                                                    보유량
                                                </th>
                                                <th class="text-right p-2">
                                                    평단가
                                                </th>
                                                <th class="text-right p-2">
                                                    액션
                                                </th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            <tr
                                                v-for="asset in account.children"
                                                :key="asset.key">
                                                <td class="p-2">
                                                    <div
                                                        class="flex align-items-center gap-2">
                                                        <i
                                                            :class="`${asset.data.icon} text-primary`"></i>
                                                        <span
                                                            class="font-semibold"
                                                            >{{
                                                                asset.data.name
                                                            }}</span
                                                        >
                                                    </div>
                                                </td>
                                                <td class="text-right p-2">
                                                    {{
                                                        formatCurrency(
                                                            asset.data.amount,
                                                            asset.data.currency
                                                        )
                                                    }}
                                                </td>
                                                <td class="text-right p-2">
                                                    {{ formatNumber(1) }}
                                                </td>
                                                <td class="text-right p-2">
                                                    {{
                                                        formatCurrency(
                                                            asset.data.amount,
                                                            asset.data.currency
                                                        )
                                                    }}
                                                </td>
                                                <td class="text-right p-2">
                                                    <!-- 액션 버튼은 나중에 추가 -->
                                                </td>
                                            </tr>
                                        </tbody>
                                    </table>
                                </div>
                                <div
                                    v-else
                                    class="p-4 pl-6 text-surface-500 text-center">
                                    등록된 자산이 없습니다.
                                </div>
                            </div>
                        </div>
                    </template>
                </Card>
            </div>

            <Card v-if="treeData.length === 0">
                <template #content>
                    <div class="flex flex-column align-items-center gap-3 p-4">
                        <i class="pi pi-inbox text-6xl text-surface-400"></i>
                        <p class="text-surface-500">등록된 자산이 없습니다.</p>
                    </div>
                </template>
            </Card>
        </div>

        <!-- 종목 기준 보기 -->
        <div v-else>
            <Card v-if="stockViewData.length > 0">
                <template #content>
                    <table class="w-full">
                        <thead>
                            <tr
                                class="text-sm text-surface-500 border-bottom-1">
                                <th class="text-left p-3">종목</th>
                                <th class="text-right p-3">평가액</th>
                                <th class="text-right p-3">보유량</th>
                                <th class="text-right p-3">평단가</th>
                                <th class="text-right p-3">계좌</th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr
                                v-for="stock in stockViewData"
                                :key="stock.symbol">
                                <td class="p-3">
                                    <div class="flex align-items-center gap-2">
                                        <span class="font-semibold">{{
                                            stock.name
                                        }}</span>
                                        <Tag
                                            :value="stock.type"
                                            severity="info" />
                                    </div>
                                </td>
                                <td class="text-right p-3">
                                    {{
                                        formatCurrency(
                                            stock.totalAmount,
                                            stock.currency
                                        )
                                    }}
                                </td>
                                <td class="text-right p-3">
                                    {{ formatNumber(stock.totalQuantity) }}
                                </td>
                                <td class="text-right p-3">
                                    {{
                                        formatCurrency(
                                            stock.avgPrice,
                                            stock.currency
                                        )
                                    }}
                                </td>
                                <td class="text-right p-3">
                                    <span class="text-sm text-surface-500">
                                        {{ stock.accounts.length }}개
                                    </span>
                                </td>
                            </tr>
                        </tbody>
                    </table>
                </template>
            </Card>

            <Card v-else>
                <template #content>
                    <div class="flex flex-column align-items-center gap-3 p-4">
                        <i class="pi pi-inbox text-6xl text-surface-400"></i>
                        <p class="text-surface-500">등록된 자산이 없습니다.</p>
                    </div>
                </template>
            </Card>
        </div>
    </div>
</template>
