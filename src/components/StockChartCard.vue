<!-- stock\src\components\StockChartCard.vue -->
<script setup>
    import { ref, computed } from 'vue';
    import { useBreakpoint } from '@/composables/useBreakpoint';
    import { getGroupSeverity } from '@/utils/uiHelpers.js';
    import Card from 'primevue/card';
    import SelectButton from 'primevue/selectbutton';
    import Dropdown from 'primevue/dropdown';
    import Tag from 'primevue/tag';
    import Button from 'primevue/button';
    import AddAssetModal from '@/components/asset/AddAssetModal.vue';
    // import StockCalculators from '@/components/StockCalculators.vue';

    const props = defineProps({
        tickerInfo: Object,
        dividendHistory: Array,
        userBookmark: Object,
        viewOptions: Array,
        timeRangeOptions: Array,
        currentView: String,
        selectedTimeRange: String,
    });

    const emit = defineEmits([
        'update:currentView',
        'update:selectedTimeRange',
    ]);
    const { isDesktop, isMobile } = useBreakpoint();
    const buttonSize = computed(() => (isMobile.value ? 'small' : null));

    // Asset Modal
    const showAddAssetModal = ref(false);

    const handleAssetSaved = async (data) => {
        console.log('Asset saved:', data);
        // 여기서 Firestore에 저장하는 로직 추가
    };

    const currentPrice = computed(() => {
        return props.tickerInfo?.price || 0;
    });

    const localCurrentView = computed({
        get: () => props.currentView,
        set: (value) => emit('update:currentView', value),
    });
    const localSelectedTimeRange = computed({
        get: () => props.selectedTimeRange,
        set: (value) =>
            emit(
                'update:selectedTimeRange',
                typeof value === 'object' ? value.value : value
            ),
    });
    const dropdownTimeRangeOptions = computed(() =>
        props.timeRangeOptions?.map((opt) => ({
            name: opt.label,
            code: opt.value,
        }))
    );
</script>

<template>
    <Card class="toto-chart">
        <template #content>
            <div class="toto-chart-header mb-4">
                <div
                    class="flex gap-2"
                    :class="isMobile ? 'flex-column' : 'flex-grow-1'">
                    <SelectButton
                        v-if="viewOptions && viewOptions.length > 1"
                        v-model="localCurrentView"
                        :options="viewOptions"
                        :size="buttonSize" />
                    <template
                        v-if="
                            timeRangeOptions &&
                            timeRangeOptions.length > 0 &&
                            currentView !== '주가'
                        ">
                        <SelectButton
                            v-if="isDesktop"
                            v-model="localSelectedTimeRange"
                            :options="timeRangeOptions"
                            optionLabel="label"
                            optionValue="value" />
                        <Dropdown
                            v-else
                            v-model="localSelectedTimeRange"
                            :options="dropdownTimeRangeOptions"
                            optionLabel="name"
                            optionValue="code"
                            placeholder="기간"
                            :size="buttonSize" />
                    </template>
                </div>
                <div class="flex align-items-center gap-2" v-if="tickerInfo">
                    <Tag v-if="tickerInfo.frequency" severity="secondary">{{
                        tickerInfo.frequency
                    }}</Tag>
                    <Tag
                        v-if="tickerInfo.group"
                        :severity="getGroupSeverity(tickerInfo.group)"
                        >{{ tickerInfo.group }}</Tag
                    >
                    <!-- <StockCalculators
                        v-if="dividendHistory && dividendHistory.length > 0"
                        :dividendHistory="dividendHistory"
                        :tickerInfo="tickerInfo"
                        :userBookmark="userBookmark" /> -->
                    <!-- [핵심 수정] 기존 StockCalculators 컴포넌트를 slot으로 변경 -->
                    <slot name="calculators"></slot>
                    <!--자산관리에 저장-->
                    <Button
                        icon="pi pi-wallet"
                        text
                        @click="showAddAssetModal = true"
                        v-tooltip="'자산관리에 저장'" />
                    <!--// 자산관리에 저장-->
                </div>
            </div>
        </template>
    </Card>

    <!-- Add Asset Modal -->
    <AddAssetModal
        :visible="showAddAssetModal"
        :ticker="tickerInfo?.symbol || ''"
        :price="currentPrice"
        @update:visible="showAddAssetModal = $event"
        @saved="handleAssetSaved" />
</template>
