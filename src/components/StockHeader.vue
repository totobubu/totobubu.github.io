<!-- stock\src\components\StockHeader.vue -->
<script setup>
    import { computed } from 'vue';
    import { formatLargeNumber } from '@/utils/numberFormat.js';

    // PrimeVue 컴포넌트 import
    import Card from 'primevue/card';
    import Tag from 'primevue/tag';

    const props = defineProps({
        info: Object,
    });

    const stockDetails = computed(() => {
        if (!props.info) return [];

        const detailMapping = [
            {
                key:
                    props.info.marketCap && props.info.marketCap !== 'N/A'
                        ? 'marketCap'
                        : 'totalAssets',
                label:
                    props.info.marketCap && props.info.marketCap !== 'N/A'
                        ? '시가총액'
                        : '운용 자산 (AUM)',
                formatter: formatLargeNumber,
            },
            {
                key: 'enterpriseValue',
                label: '기업가치',
                formatter: formatLargeNumber,
            },
            { key: 'earningsDate', label: '실적발표일' },
            { key: 'Volume', label: '거래량', formatter: formatLargeNumber },
            {
                key: 'AvgVolume',
                label: '평균거래량',
                formatter: formatLargeNumber,
            },
            {
                key: 'sharesOutstanding',
                label: '유통 주식 수',
                formatter: formatLargeNumber,
            },
            { key: 'Yield', label: '연간 배당률' },
            { key: 'dividendRate', label: '연간 배당금' },
            { key: 'payoutRatio', label: '배당 성향' },
            { key: 'NAV', label: '순자산가치 (NAV)' },
        ];

        // [핵심 수정] 새로운 'changes' 객체 구조에 맞춰 로직 변경
        return detailMapping
            .map((item) => {
                const rawValue = props.info[item.key];

                // 1. props.info.changes 객체에서 해당 key의 변경 정보를 찾습니다.
                const changeInfo = props.info.changes
                    ? props.info.changes[item.key]
                    : null;

                // 2. (선택적) 포맷팅이 필요한 경우, previousValue를 포맷팅합니다.
                if (changeInfo && changeInfo.value && item.formatter) {
                    changeInfo.value = item.formatter(changeInfo.value);
                }

                return {
                    label: item.label,
                    value: item.formatter ? item.formatter(rawValue) : rawValue,
                    changeInfo: changeInfo, // 찾은 변경 정보를 할당
                };
            })
            .filter(
                (item) =>
                    item.value &&
                    item.value !== 'N/A' &&
                    item.value !== '0' &&
                    item.value !== '$0' &&
                    item.value !== '$-0'
            );
    });

    const getChangeIcon = (change) => {
        if (change === 'up') return 'pi pi-arrow-up';
        if (change === 'down') return 'pi pi-arrow-down';
        return 'pi pi-equals';
    };

    const getChangeSeverity = (change) => {
        if (change === 'up') return 'success';
        if (change === 'down') return 'danger';
        return 'contrast';
    };
</script>

<template>
    <div v-if="info" id="t-stock-header">
        <Card
            class="status flex-1 min-w-[240px]"
            v-for="detail in stockDetails"
            :key="detail.label">
            <template #title>
                <span>{{ detail.label }}</span>
            </template>
            <template #content>
                <p class="">{{ detail.value }}</p>
            </template>
            <template #footer>
                <!-- [핵심 수정] changeInfo.previousValue -> changeInfo.value 로 변경 -->
                <div v-if="detail.changeInfo" class="absolute top-2 right-2">
                    <Tag
                        class="stats-badge"
                        :severity="getChangeSeverity(detail.changeInfo.change)">
                        <i :class="getChangeIcon(detail.changeInfo.change)" />
                    </Tag>
                </div>
            </template>
        </Card>
    </div>
</template>
