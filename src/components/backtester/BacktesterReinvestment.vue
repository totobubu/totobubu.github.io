<!-- src\components\backtester\BacktesterReinvestment.vue -->
<script setup>
    import { computed, watch } from 'vue';
    import Dropdown from 'primevue/dropdown';
    import InputNumber from 'primevue/inputnumber';
    import Button from 'primevue/button';
    import MeterGroup from 'primevue/metergroup';

    const rules = defineModel('rules');
    const props = defineProps({
        availableStocks: { type: Array, default: () => [] },
    });

    const userDefinedRules = computed(
        () => rules.value?.filter((rule) => rule.targetSymbol !== 'CASH') || []
    );

    const cashRule = computed(() =>
        rules.value?.find((rule) => rule.targetSymbol === 'CASH')
    );

    const reinvestTargetOptions = computed(() =>
        props.availableStocks.map((s) => ({ label: s.symbol, value: s.symbol }))
    );

    const meterGroupValue = computed(() => {
        if (!rules.value) return [];
        return rules.value
            .filter((rule) => (rule.ratio || 0) > 0)
            .map((rule) => ({
                label: rule.targetSymbol,
                value: rule.ratio || 0,
                color: getColorBySymbol(rule.targetSymbol),
            }));
    });

    const reinvestmentTotal = computed(() =>
        meterGroupValue.value.reduce((sum, item) => sum + item.value, 0)
    );

    watch(
        userDefinedRules,
        (newRules) => {
            const userDefinedTotal = newRules.reduce(
                (sum, rule) => sum + (rule.ratio || 0),
                0
            );
            if (cashRule.value) {
                cashRule.value.ratio = Math.max(0, 100 - userDefinedTotal);
            }
        },
        { deep: true }
    );

    const COLORS = [
        '#3B82F6',
        '#10B981',
        '#F59E0B',
        '#8B5CF6',
        '#EC4899',
        '#6366F1',
    ];
    function getColorBySymbol(symbol) {
        if (!symbol || symbol === 'CASH') return '#6c757d';
        let hash = 0;
        for (let i = 0; i < symbol.length; i++)
            hash = symbol.charCodeAt(i) + ((hash << 5) - hash);
        return COLORS[Math.abs(hash) % COLORS.length];
    }

    const addRule = () => {
        if (!rules.value) {
            rules.value = [];
        }
        rules.value.push({
            key: `reinvest-${Date.now()}`,
            targetSymbol: null,
            ratio: 0,
        });
    };
    const removeRule = (index) => {
        // userDefinedRules는 computed이므로 직접 수정 불가. 원본 rules 배열에서 해당 인덱스를 찾아 제거해야 함.
        const ruleToRemove = userDefinedRules.value[index];
        const originalIndex = rules.value.findIndex(
            (r) => r.key === ruleToRemove.key
        );
        if (originalIndex > -1) {
            rules.value.splice(originalIndex, 1);
        }
    };
</script>
<template>
    <div class="surface-card p-4 border-round">
        <h3 class="font-bold mt-0 mb-4">2. 통합 배당금 재투자 규칙</h3>
        <MeterGroup :value="meterGroupValue" class="mb-4">
            <template #start>
                <div class="flex justify-content-between">
                    <span>분배 현황</span>
                    <span
                        :class="
                            reinvestmentTotal === 100
                                ? 'text-green-500'
                                : 'text-red-500'
                        "
                        >{{ reinvestmentTotal }}% / 100%</span
                    >
                </div>
            </template>
        </MeterGroup>
        <div class="flex flex-column gap-3">
            <div
                v-if="cashRule"
                class="grid formgrid p-fluid align-items-center">
                <div class="field col-8 mb-0">
                    <div class="p-2 border-round surface-200 dark:surface-700">
                        <i class="pi pi-dollar mr-2"></i>현금 비축
                    </div>
                </div>
                <div class="field col-4 mb-0">
                    <InputNumber
                        v-model="cashRule.ratio"
                        suffix=" %"
                        disabled />
                </div>
            </div>
            <div
                v-for="(rule, index) in userDefinedRules"
                :key="rule.key"
                class="grid formgrid p-fluid align-items-center">
                <div class="field col-6 mb-0">
                    <Dropdown
                        v-model="rule.targetSymbol"
                        :options="reinvestTargetOptions"
                        optionLabel="label"
                        optionValue="value"
                        placeholder="재투자 대상" />
                </div>
                <div class="field col-4 mb-0">
                    <InputNumber v-model="rule.ratio" suffix=" %" />
                </div>
                <div class="col-2">
                    <Button
                        icon="pi pi-trash"
                        severity="danger"
                        text
                        @click="removeRule(index)" />
                </div>
            </div>
            <Button
                label="규칙 추가"
                icon="pi pi-plus"
                @click="addRule"
                outlined />
        </div>
    </div>
</template>
