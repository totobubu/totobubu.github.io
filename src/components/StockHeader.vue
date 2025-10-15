<!-- REFACTORED: src/components/StockHeader.vue -->
<script setup>
    import { computed } from 'vue';
    import Tag from 'primevue/tag';
    import Card from 'primevue/card';

    const props = defineProps({
        info: Object,
    });

    // utils.js에서 가져온다고 가정
    const formatLargeNumber = (value) => {
        if (typeof value !== 'string') return value;
        // 간단한 예시, 실제 구현은 utils.js에 따름
        return value.replace(/\s*₩$/, '').replace(/\s*USD$/, '');
    };

    const stockDetails = computed(() => {
        if (!props.info) return [];
        const info = props.info;
        const currency = info.currency || 'USD';

        const detailMapping = [
            { key: 'market', label: '시장' },
            { key: 'marketCap', label: '시가총액' },
            { key: 'enterpriseValue', label: '기업가치' },
            { key: 'earningsDate', label: '실적발표일' },
            { key: 'Volume', label: '거래량' },
            { key: 'AvgVolume', label: '평균거래량' },
            { key: 'sharesOutstanding', label: '유통 주식 수' },
            { key: 'Yield', label: '연간 배당률' },
            { key: 'dividendRate', label: '연간 배당금' },
            { key: 'payoutRatio', label: '배당 성향' },
        ];

        return detailMapping
            .map((item) => ({
                label: item.label,
                value: info[item.key],
                changeInfo: info.changes?.[item.key],
            }))
            .filter(
                (item) =>
                    item.value && item.value !== 'N/A' && item.value !== '0'
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
                    :value="detail.value.toUpperCase()"
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
