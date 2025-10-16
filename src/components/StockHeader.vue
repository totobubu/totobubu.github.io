<!-- REFACTORED: src/components/StockHeader.vue -->
<script setup>
    import { computed } from 'vue';
    import { formatCurrency, formatLargeNumber } from '@/utils/formatters.js';
    import Tag from 'primevue/tag';
    import Card from 'primevue/card';

    const props = defineProps({
        info: Object, // 순수 숫자/문자열 데이터를 가진 tickerInfo 객체
    });

    const stockDetails = computed(() => {
        if (!props.info) return [];
        const info = props.info;
        const currency = info.currency || 'USD';

        const detailMapping = [
            { key: 'market', label: '시장' },
            {
                key: 'marketCap',
                label: '시가총액',
                formatter: (val) => formatLargeNumber(val, currency),
            },
            {
                key: 'enterpriseValue',
                label: '기업가치',
                formatter: (val) => formatLargeNumber(val, currency),
            },
            { key: 'earningsDate', label: '실적발표일' },
            {
                key: 'Volume',
                label: '거래량',
                formatter: (val) => formatLargeNumber(val, currency),
            },
            {
                key: 'AvgVolume',
                label: '평균거래량',
                formatter: (val) => formatLargeNumber(val, currency),
            },
            {
                key: 'sharesOutstanding',
                label: '유통 주식 수',
                formatter: (val) => formatLargeNumber(val, currency),
            },
            {
                key: 'Yield',
                label: '연간 배당률',
                formatter: (val) =>
                    val && val > 0 ? `${val.toFixed(2)}%` : 'N/A',
            },
            {
                key: 'dividendRate',
                label: '연간 배당금',
                formatter: (val) => formatCurrency(val, currency),
            },
            {
                key: 'payoutRatio',
                label: '배당 성향',
                formatter: (val) =>
                    val ? `${(val * 100).toFixed(2)}%` : 'N/A',
            },
            { key: '52Week', label: '52주 변동폭' }, // 52Week는 포맷팅된 문자열이므로 formatter 없음
        ];

        return detailMapping
            .map((item) => {
                const value = info[item.key];
                return {
                    label: item.label,
                    value: item.formatter ? item.formatter(value) : value,
                    changeInfo: info.changes?.[item.key],
                };
            })
            .filter(
                (item) =>
                    item.value &&
                    item.value !== 'N/A' &&
                    item.value !== 0 &&
                    item.value !== '0'
            );
    });

    const getChangeIcon = (change) =>
        ({ up: 'pi pi-arrow-up', down: 'pi pi-arrow-down' })[change] ||
        'pi pi-equals';
    const getChangeSeverity = (change) =>
        ({ up: 'success', down: 'danger' })[change] || 'contrast';
</script>

<template>
    <div v-if="info" id="t-stock-header">
        <Card class="status" v-for="detail in stockDetails" :key="detail.label">
            <template #title>
                <span>{{ detail.label }}</span>
            </template>
            <template #content>
                <Tag
                    v-if="detail.label === '시장'"
                    :value="String(detail.value).toUpperCase()"
                    severity="contrast"
                    class="font-bold" />
                <p v-else>{{ detail.value }}</p>
            </template>
            <template #footer>
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
