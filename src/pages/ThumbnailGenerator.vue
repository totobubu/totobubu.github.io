// CREATE NEW FILE: src/pages/ThumbnailGenerator.vue
<script setup>
    import { ref } from 'vue';
    import { useHead } from '@vueuse/head';
    import html2canvas from 'html2canvas';

    import Button from 'primevue/button';
    import InputText from 'primevue/inputtext';
    import InputNumber from 'primevue/inputnumber';
    import FloatLabel from 'primevue/floatlabel';
    import Dropdown from 'primevue/dropdown';

    useHead({
        title: '썸네일 생성기',
        meta: [{ name: 'robots', content: 'noindex, nofollow' }],
    });

    const thumbnailPreview = ref(null);

    const companyOptions = ref([
        { name: 'YieldMax', logo: '/logos/yieldmax.png', theme: 'yieldmax' },
        { name: 'Roundhill', logo: '/logos/roundhill.png', theme: 'roundhill' },
    ]);

    const selectedCompany = ref(companyOptions.value[0]);
    const date = ref('25. 10. 9');
    const weekNo = ref('42');
    const ticker = ref('YMAX');
    const dividendAmount = ref(0.147);
    const comparisonText = ref('LAST WEEK $ +0.0071');
    const description = ref('YIELDMAX™ UNIVERSE FUND OF OPTION INCOME ETFS');
    const tickerColor = ref('#facc15'); // Yellow for YMAX

    const downloadImage = () => {
        if (!thumbnailPreview.value) return;

        html2canvas(thumbnailPreview.value, {
            useCORS: true,
            allowTaint: true,
            backgroundColor: null, // 투명 배경으로 캡처
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
                        <div class="field col-6">
                            <FloatLabel>
                                <InputText v-model="date" />
                                <label>날짜 (예: 25. 10. 9)</label>
                            </FloatLabel>
                        </div>
                        <div class="field col-6">
                            <FloatLabel>
                                <InputText v-model="weekNo" />
                                <label>주차 (괄호 안 숫자)</label>
                            </FloatLabel>
                        </div>
                        <div class="field col-6">
                            <FloatLabel>
                                <InputText
                                    v-model="ticker"
                                    @update:modelValue="
                                        (val) => (ticker = val.toUpperCase())
                                    " />
                                <label>티커</label>
                            </FloatLabel>
                        </div>
                        <div class="field col-6">
                            <FloatLabel>
                                <InputText v-model="tickerColor" />
                                <label>티커 색상 (HEX)</label>
                            </FloatLabel>
                        </div>
                        <div class="field col-12">
                            <FloatLabel>
                                <InputNumber
                                    v-model="dividendAmount"
                                    mode="decimal"
                                    :minFractionDigits="4"
                                    :maxFractionDigits="6" />
                                <label>배당금</label>
                            </FloatLabel>
                        </div>
                        <div class="field col-12">
                            <FloatLabel>
                                <InputText v-model="comparisonText" />
                                <label>비교 문구</label>
                            </FloatLabel>
                        </div>
                        <div class="field col-12">
                            <FloatLabel>
                                <InputText v-model="description" />
                                <label>설명</label>
                            </FloatLabel>
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
                <img
                    src="@/assets/thumbnail/blue.png"
                    class="bg-image"
                    alt="" />
                <div class="header">
                    <img
                        :src="selectedCompany.logo"
                        alt="Company Logo"
                        class="logo" />
                    <span class="date">{{ date }} ({{ weekNo }})</span>
                </div>
                <div class="main-content">
                    <h1
                        class="ticker"
                        :style="{
                            color: tickerColor,
                            textShadow: `0 0 15px ${tickerColor}`,
                        }">
                        {{ ticker }}
                    </h1>
                    <h2 class="amount">${{ dividendAmount }}</h2>
                </div>
                <div class="footer">
                    <p class="comparison">{{ comparisonText }}</p>
                    <p class="description">{{ description }}</p>
                </div>
                <div class="sparkle"></div>
            </div>
        </div>
    </div>
</template>
