<script setup>
    import { computed, watch } from 'vue';
    import OrganizationChart from 'primevue/organizationchart';
    import Button from 'primevue/button';
    import InputNumber from 'primevue/inputnumber';
    import Dropdown from 'primevue/dropdown';

    const data = defineModel('value', { type: Object, required: true });

    const props = defineProps({
        availableStocks: { type: Array, default: () => [] },
    });

    const today = new Date();

    const reinvestTargetOptions = computed(() => {
        return [
            { label: '현금 비축', value: 'CASH' },
            ...props.availableStocks.map((s) => ({
                label: s.symbol,
                value: s.symbol,
            })),
        ];
    });

    function findNodeByKey(root, key, parent = null) {
        if (root.key === key) return { node: root, parent };
        if (root.children) {
            for (const child of root.children) {
                const found = findNodeByKey(child, key, root);
                if (found) return found;
            }
        }
        return null;
    }

    const addNode = (node) => {
        if (node.type === 'add-button' && node.key === 'add-stock') {
            const newStockKey = `stock-${data.value.children.length - 1}`;
            const newStockNode = {
                key: newStockKey,
                type: 'stock',
                data: {
                    symbol: null,
                    quantity: null,
                    avgPrice: null,
                    ratioStatus: 'valid',
                },
                children: [
                    {
                        key: `${newStockKey}-cash`,
                        type: 'reinvest-target',
                        data: { targetSymbol: 'CASH', ratio: 100 },
                    },
                    { key: `${newStockKey}-add`, type: 'add-button' },
                ],
            };
            data.value.children.splice(-1, 0, newStockNode);
        } else if (node.type === 'add-button') {
            const { node: parentNode } = findNodeByKey(
                data.value,
                node.key.replace('-add', '')
            );
            if (parentNode && parentNode.type === 'stock') {
                const newReinvestKey = `${parentNode.key}-reinvest-${parentNode.children.length - 2}`;
                const newReinvestNode = {
                    key: newReinvestKey,
                    type: 'reinvest-target',
                    data: { ratio: 0 },
                };
                parentNode.children.splice(-1, 0, newReinvestNode);
            }
        }
    };

    const removeNode = (nodeToRemove) => {
        const { parent } = findNodeByKey(data.value, nodeToRemove.key);
        if (parent && parent.children) {
            parent.children = parent.children.filter(
                (child) => child.key !== nodeToRemove.key
            );
        }
    };

    watch(
        data,
        (newData) => {
            if (!newData || !newData.children) return;
            newData.children.forEach((stockNode) => {
                if (stockNode.type === 'stock' && stockNode.children) {
                    const totalRatio = stockNode.children
                        .filter((c) => c.type === 'reinvest-target')
                        .reduce((sum, c) => sum + (c.data.ratio || 0), 0);

                    if (!stockNode.data) stockNode.data = {};
                    stockNode.data.ratioStatus =
                        totalRatio === 100 ? 'valid' : 'invalid';
                }
            });
        },
        { deep: true }
    );
</script>

<template>
    <div class="surface-card p-4 border-round">
        <h3 class="font-bold mt-0 mb-4 text-center">
            종목 및 재투자 규칙 설정
        </h3>
        <OrganizationChart
            v-if="data && data.children"
            :value="{ key: 'dummy-root', children: data.children }"
            collapsible>
            <template #stock="slotProps">
                <div
                    class="p-3 border-round surface-100 dark:surface-700 relative">
                    <Button
                        icon="pi pi-times"
                        severity="danger"
                        text
                        rounded
                        class="absolute"
                        style="top: -0.5rem; right: -0.5rem"
                        @click="removeNode(slotProps.node)" />
                    <div class="flex flex-column gap-3">
                        <Dropdown
                            v-model="slotProps.node.data.symbol"
                            :options="availableStocks"
                            optionLabel="longName"
                            optionValue="symbol"
                            placeholder="종목 선택"
                            filter />
                        <InputNumber
                            v-model="slotProps.node.data.quantity"
                            placeholder="보유량 (원금회수용)" />
                        <InputNumber
                            v-model="slotProps.node.data.avgPrice"
                            placeholder="평단가 (원금회수용)"
                            mode="currency"
                            currency="USD" />
                    </div>
                </div>
            </template>
            <template #reinvest-target="slotProps">
                <div
                    class="p-2 border-round surface-50 dark:surface-600 w-full"
                    :class="{
                        'border-2 border-red-500':
                            slotProps.node.parent.data.ratioStatus ===
                            'invalid',
                    }">
                    <div class="flex align-items-center gap-2">
                        <div
                            v-if="slotProps.node.data.targetSymbol === 'CASH'"
                            class="p-2 bg-primary-reverse border-round">
                            현금 비축
                        </div>
                        <Dropdown
                            v-else
                            v-model="slotProps.node.data.targetSymbol"
                            :options="reinvestTargetOptions"
                            optionLabel="label"
                            optionValue="value"
                            placeholder="재투자 대상"
                            class="flex-grow-1" />
                        <InputNumber
                            v-model="slotProps.node.data.ratio"
                            suffix=" %"
                            class="w-8rem" />
                        <Button
                            v-if="slotProps.node.data.targetSymbol !== 'CASH'"
                            icon="pi pi-times"
                            severity="danger"
                            text
                            @click="removeNode(slotProps.node)" />
                    </div>
                </div>
            </template>
            <template #add-button="slotProps">
                <Button
                    icon="pi pi-plus"
                    rounded
                    severity="secondary"
                    @click="addNode(slotProps.node)" />
            </template>
        </OrganizationChart>
    </div>
</template>
