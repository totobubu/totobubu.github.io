<!-- src/components/thumbnail/ThumbnailItem.vue -->
<script setup>
    import { computed } from 'vue';

    const props = defineProps({
        data: Object,
    });

    const chartData = computed(() => {
        if (!props.data.showChart || !props.data.chartDividends) return [];

        // 월별로 그룹화
        const monthlyGroups = {};
        props.data.chartDividends.forEach((dividend) => {
            const date = new Date(dividend.date);
            const yearMonth = `${date.getFullYear().toString().slice(-2)}.${(date.getMonth() + 1).toString().padStart(2, '0')}`;
            const amount = dividend.amountFixed ?? dividend.amount;

            if (!monthlyGroups[yearMonth]) {
                monthlyGroups[yearMonth] = [];
            }
            monthlyGroups[yearMonth].push(amount);
        });

        // 최신 월순으로 정렬
        return Object.keys(monthlyGroups)
            .sort((a, b) => {
                const [ya, ma] = a.split('.').map(Number);
                const [yb, mb] = b.split('.').map(Number);
                if (ya !== yb) return yb - ya;
                return mb - ma;
            })
            .slice(0, 3) // 최근 3개월만 표시
            .map((month) => ({
                month,
                amounts: monthlyGroups[month],
                total: monthlyGroups[month].reduce((sum, amt) => sum + amt, 0),
            }));
    });

    const weekColors = [
        '#4285F4',
        '#EA4335',
        '#FBBC04',
        '#34A853',
        '#FF6D01',
        '#9C27B0',
        '#00BCD4',
    ];
    const getColor = (index) => weekColors[index % weekColors.length];

    const formatAmount = (amount) => {
        return `$${Number(amount.toFixed(4))}`;
    };
</script>

<template>
    <div class="thumbnail-item-wrapper">
        <div
            class="thumbnail-container"
            :class="{ 'with-chart': data.showChart }">
            <img :src="data.backgroundImageUrl" class="bg-image" alt="" />
            <div class="header">
                <img :src="data.logo" alt="Company Logo" class="logo" />
                <span class="date"
                    >{{ data.date }}
                    <span v-if="data.weekNo">({{ data.weekNo }})</span></span
                >
            </div>
            <div class="main-content" :class="{ 'with-chart': data.showChart }">
                <h1 class="ticker" :style="{ color: data.tickerColor }">
                    {{ data.symbol }}
                </h1>
                <h2 class="amount">${{ data.formattedCurrentAmount }}</h2>
            </div>
            <div class="footer" :class="{ 'with-chart': data.showChart }">
                <p class="comparison">{{ data.comparisonText }}</p>
                <p class="description">
                    {{ data.descriptionLine1 }}<br />{{ data.descriptionLine2 }}
                </p>
            </div>
            <!-- 차트 영역 -->
            <div
                v-if="data.showChart && chartData.length > 0"
                class="chart-section">
                <div
                    v-for="item in chartData"
                    :key="item.month"
                    class="chart-row">
                    <span class="chart-month">{{ item.month }}</span>
                    <div class="chart-bar">
                        <div
                            v-for="(amount, idx) in item.amounts"
                            :key="idx"
                            class="chart-segment"
                            :style="{
                                width: `${(amount / item.total) * 100}%`,
                                backgroundColor: getColor(idx),
                            }">
                            <span class="segment-label">{{
                                formatAmount(amount)
                            }}</span>
                        </div>
                    </div>
                    <span class="chart-total">{{
                        formatAmount(item.total)
                    }}</span>
                </div>
            </div>
        </div>
    </div>
</template>
