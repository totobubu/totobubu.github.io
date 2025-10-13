<!-- REFACTORED: src/components/thumbnail/ThumbnailItem.vue -->
<script setup>
    defineProps({
        data: Object,
    });
</script>

<template>
    <div class="thumbnail-item-wrapper">
        <div class="thumbnail-container">
            <img :src="data.backgroundImageUrl" class="bg-image" alt="" />
            <div class="header">
                <img :src="data.logo" alt="Company Logo" class="logo" />
                <span class="date"
                    >{{ data.date }}
                    <span v-if="data.weekNo">({{ data.weekNo }})</span></span
                >
            </div>
            <div class="main-content">
                <h1 class="ticker" :style="{ color: data.tickerColor }">
                    {{ data.symbol }}
                </h1>
                <h2 class="amount">${{ data.formattedCurrentAmount }}</h2>
            </div>
            <div class="footer">
                <p class="comparison">{{ data.comparisonText }}</p>
                <p class="description">
                    {{ data.descriptionLine1 }}<br />{{ data.descriptionLine2 }}
                </p>
            </div>
        </div>
    </div>
</template>
