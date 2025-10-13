<!-- REFACTORED: src/pages/ThumbnailGenerator.vue -->
<script setup>
    import { ref, computed } from 'vue';
    import { useHead } from '@vueuse/head';
    import html2canvas from 'html2canvas';

    import Button from 'primevue/button';
    import InputText from 'primevue/inputtext';
    import InputNumber from 'primevue/inputnumber';
    import FloatLabel from 'primevue/floatlabel';
    import Dropdown from 'primevue/dropdown';
    import Card from 'primevue/card';
    import SelectButton from 'primevue/selectbutton';
    import InputGroup from 'primevue/inputgroup';

    useHead({
        title: '썸네일 생성기',
        meta: [{ name: 'robots', content: 'noindex, nofollow' }],
        link: [
            { rel: 'preconnect', href: 'https://fonts.googleapis.com' },
            {
                rel: 'preconnect',
                href: 'https://fonts.gstatic.com',
                crossorigin: true,
            },
            {
                href: 'https://fonts.googleapis.com/css2?family=Montserrat:wght@700;900&family=Bungee&display=swap',
                rel: 'stylesheet',
            },
        ],
    });

    const thumbnailPreview = ref(null);

    const companyOptions = ref([
        {
            name: 'YieldMax',
            logo: '/src/assets/thumbnail/yieldmax.png',
            theme: 'yieldmax',
        },
        {
            name: 'Roundhill',
            logo: '/logos/roundhill.svg',
            theme: 'roundhill',
        },
    ]);

    const backgroundOptions = ref([
        {
            name: 'Blue',
            path: '/src/assets/thumbnail/blue.png',
            tickerColor: '#6ffc04',
        },
        {
            name: 'Gray',
            path: '/src/assets/thumbnail/gray.png',
            tickerColor: '#ffd700',
        },
        {
            name: 'Red',
            path: '/src/assets/thumbnail/red.png',
            tickerColor: '#ffd700',
        },
    ]);

    const selectedCompany = ref(companyOptions.value[0]);
    const selectedBackground = ref(backgroundOptions.value[0]);
    const date = ref('25. 10. 9');
    const weekNo = ref('42');
    const ticker = ref('YMAX');

    const previousDividendAmount = ref(0.1399);
    const currentDividendAmount = ref(0.147);

    const comparisonPrefix = ref('LAST WEEK');
    const comparisonPrefixOptions = ref(['LAST WEEK', 'LAST TIME']);

    const comparisonText = computed(() => {
        const diff = currentDividendAmount.value - previousDividendAmount.value;
        const sign = diff >= 0 ? '+' : '-';
        const formattedDiff = Math.abs(diff).toFixed(6);
        return `${comparisonPrefix.value} $ ${sign}${formattedDiff}`;
    });

    const descriptionLine1 = ref('YIELDMAX™ UNIVERSE FUND');
    const descriptionLine2 = ref('OF OPTION INCOME ETFS');

    const backgroundImageUrl = computed(() => {
        return new URL(selectedBackground.value.path, import.meta.url).href;
    });

    const downloadImage = () => {
        if (!thumbnailPreview.value) return;

        html2canvas(thumbnailPreview.value, {
            useCORS: true,
            allowTaint: true,
            backgroundColor: null,
        }).then((canvas) => {
            const link = document.createElement('a');
            link.download = `${ticker.value.toLowerCase()}-thumbnail.png`;
            link.href = canvas.toDataURL('image/png');
            link.click();
        });
    };
</script>

<template>
    <div class="thumbnail-page">
        <div class="controls">
            <Card>
                <template #title>썸네일 생성기</template>
                <template #content>
                    <div class="p-fluid formgrid grid">
                        <div class="field col-12">
                            <FloatLabel>
                                <Dropdown
                                    v-model="selectedCompany"
                                    :options="companyOptions"
                                    optionLabel="name"
                                    class="w-full" />
                                <label>회사</label>
                            </FloatLabel>
                        </div>
                        <div class="field col-12">
                            <FloatLabel>
                                <Dropdown
                                    v-model="selectedBackground"
                                    :options="backgroundOptions"
                                    optionLabel="name"
                                    class="w-full" />
                                <label>배경 이미지</label>
                            </FloatLabel>
                        </div>
                        <div class="field col-12">
                            <FloatLabel>
                                <InputText v-model="date" />
                                <label>날짜 (예: 25. 10. 9)</label>
                            </FloatLabel>
                        </div>
                        <div class="field col-12">
                            <FloatLabel>
                                <InputText v-model="weekNo" />
                                <label>주차 (선택)</label>
                            </FloatLabel>
                        </div>
                        <div class="field col-12">
                            <FloatLabel>
                                <InputText
                                    v-model="ticker"
                                    @update:modelValue="
                                        (val) => (ticker = val.toUpperCase())
                                    " />
                                <label>티커</label>
                            </FloatLabel>
                        </div>
                        <div class="field col-12 grid nested-grid">
                            <div class="col-6">
                                <FloatLabel>
                                    <InputNumber
                                        v-model="previousDividendAmount"
                                        mode="decimal"
                                        :minFractionDigits="4"
                                        :maxFractionDigits="6" />
                                    <label>이전 배당금</label>
                                </FloatLabel>
                            </div>
                            <div class="col-6">
                                <FloatLabel>
                                    <InputNumber
                                        v-model="currentDividendAmount"
                                        mode="decimal"
                                        :minFractionDigits="4"
                                        :maxFractionDigits="6" />
                                    <label>이번 배당금</label>
                                </FloatLabel>
                            </div>
                        </div>
                        <div class="field col-12">
                            <label class="mb-2 block"
                                >비교 문구 (자동 계산)</label
                            >
                            <InputGroup>
                                <SelectButton
                                    v-model="comparisonPrefix"
                                    :options="comparisonPrefixOptions"
                                    aria-labelledby="basic" />
                            </InputGroup>
                        </div>
                        <div class="field col-12">
                            <label class="mb-2 block">설명</label>
                            <div class="flex flex-column gap-2">
                                <InputText
                                    v-model="descriptionLine1"
                                    placeholder="설명 (첫째 줄)" />
                                <InputText
                                    v-model="descriptionLine2"
                                    placeholder="설명 (둘째 줄)" />
                            </div>
                        </div>
                    </div>
                </template>
                <template #footer>
                    <Button
                        label="이미지로 다운로드"
                        icon="pi pi-download"
                        @click="downloadImage"
                        class="w-full" />
                </template>
            </Card>
        </div>

        <div class="preview">
            <div
                ref="thumbnailPreview"
                class="thumbnail-container"
                :class="selectedCompany.theme">
                <img :src="backgroundImageUrl" class="bg-image" alt="" />
                <div class="header">
                    <img
                        :src="selectedCompany.logo"
                        alt="Company Logo"
                        class="logo" />
                    <span class="date"
                        >{{ date }}
                        <span v-if="weekNo">({{ weekNo }})</span></span
                    >
                </div>
                <div class="main-content">
                    <h1
                        class="ticker"
                        :style="{
                            color: selectedBackground.tickerColor,
                            textShadow: `0 0 15px ${selectedBackground.tickerColor}`,
                        }">
                        {{ ticker }}
                    </h1>
                    <h2 class="amount">${{ currentDividendAmount }}</h2>
                </div>
                <div class="footer">
                    <p class="comparison">{{ comparisonText }}</p>
                    <p class="description">
                        {{ descriptionLine1 }}<br />{{ descriptionLine2 }}
                    </p>
                </div>
            </div>
        </div>
    </div>
</template>
