<!-- REFACTORED: src/pages/ThumbnailGenerator.vue -->
<script setup>
    import { ref, onMounted, computed, watch } from 'vue';
    import { useHead } from '@vueuse/head';
    import html2canvas from 'html2canvas';
    import JSZip from 'jszip';
    import ThumbnailItem from '@/components/thumbnail/ThumbnailItem.vue';

    import Button from 'primevue/button';
    import ProgressSpinner from 'primevue/progressspinner';
    import Checkbox from 'primevue/checkbox';
    import InputText from 'primevue/inputtext';
    import SelectButton from 'primevue/selectbutton';

    useHead({
        title: '썸네일 일괄 생성기',
        meta: [{ name: 'robots', content: 'noindex, nofollow' }],
        link: [
            { rel: 'preconnect', href: 'https://fonts.googleapis.com' },
            {
                rel: 'preconnect',
                href: 'https://fonts.gstatic.com',
                crossorigin: true,
            },
            {
                href: 'https://fonts.googleapis.com/css2?family=Bungee&display=swap',
                rel: 'stylesheet',
            },
        ],
    });

    const allThumbnailsData = ref([]);
    const selectedThumbnails = ref([]);
    const isLoading = ref(true);
    const isDownloading = ref(false);
    const date = ref('');
    const groups = ref(['All']);
    const selectedGroup = ref('All');

    const companyOptions = ref([
        { name: 'YieldMax', logo: '/logos/yieldmax.png' },
        { name: 'Roundhill', logo: '/logos/roundhill.svg' },
    ]);

    // [핵심 수정 1] 이미지 경로를 public 폴더 기준으로 변경
    const backgroundOptions = ref([
        { name: 'Blue', path: '/thumbnail/blue.png', tickerColor: '#6ffc04' },
        { name: 'Gray', path: '/thumbnail/gray.png', tickerColor: '#ffd700' },
        { name: 'Red', path: '/thumbnail/red.png', tickerColor: '#ffd700' },
    ]);

    const filteredThumbnails = computed(() => {
        if (selectedGroup.value === 'All') {
            return allThumbnailsData.value;
        }
        return allThumbnailsData.value.filter(
            (t) => t.group === selectedGroup.value
        );
    });

    const isAllSelected = computed({
        get: () =>
            filteredThumbnails.value.length > 0 &&
            selectedThumbnails.value.length === filteredThumbnails.value.length,
        set: (value) => {
            const filteredSymbols = filteredThumbnails.value.map(
                (t) => t.symbol
            );
            if (value) {
                selectedThumbnails.value = [
                    ...new Set([
                        ...selectedThumbnails.value,
                        ...filteredSymbols,
                    ]),
                ];
            } else {
                selectedThumbnails.value = selectedThumbnails.value.filter(
                    (s) => !filteredSymbols.includes(s)
                );
            }
        },
    });

    watch(selectedGroup, () => {
        isAllSelected.value = true;
    });

    const formatCurrentAmount = (amount) => {
        const amountStr = String(amount);
        const parts = amountStr.split('.');
        if (parts.length < 2) return Number(amountStr).toFixed(4);
        const decimalPart = parts[1];
        if (decimalPart.length < 4) return Number(amountStr).toFixed(4);
        return amountStr;
    };

    onMounted(async () => {
        const today = new Date();
        date.value = `${String(today.getFullYear()).slice(-2)}. ${String(
            today.getMonth() + 1
        )}. ${String(today.getDate())}`;

        try {
            const response = await fetch('/thumbnail.json');
            const configs = await response.json();

            groups.value = [
                'All',
                ...new Set(configs.map((c) => c.group).filter(Boolean)),
            ];

            allThumbnailsData.value = configs.map((config) => {
                const company =
                    companyOptions.value.find(
                        (c) => c.name === config.companyName
                    ) || {};
                const background =
                    backgroundOptions.value.find(
                        (b) => b.name === config.backgroundName
                    ) || {};

                const currentDividend = config.currentDividendAmount || 0;
                const previousDividend = config.previousDividendAmount || 0;
                const diff = currentDividend - previousDividend;
                const comparisonText = `${config.comparisonPrefix} $ ${diff >= 0 ? '+' : '-'}${Number(Math.abs(diff).toFixed(6))}`;

                return {
                    ...config,
                    logo: company.logo,
                    tickerColor: background.tickerColor,
                    formattedCurrentAmount:
                        formatCurrentAmount(currentDividend),
                    comparisonText,
                    // [핵심 수정 2] new URL() 로직 제거, 경로를 직접 사용
                    backgroundImageUrl: background.path,
                };
            });

            isAllSelected.value = true;
        } catch (error) {
            console.error(
                'Failed to load or process thumbnail configs:',
                error
            );
        } finally {
            isLoading.value = false;
        }
    });

    const downloadImages = async () => {
        if (selectedThumbnails.value.length === 0) {
            alert('다운로드할 썸네일을 선택해주세요.');
            return;
        }
        isDownloading.value = true;
        const zip = new JSZip();
        const dateForFilename = date.value.replace(/[\. ]/g, '');

        for (const symbol of selectedThumbnails.value) {
            const el = document.querySelector(
                `[data-symbol="${symbol}"] .thumbnail-container`
            );
            if (!el) continue;

            try {
                const canvas = await html2canvas(el, {
                    useCORS: true,
                    allowTaint: true,
                    backgroundColor: null,
                });
                const blob = await new Promise((resolve) =>
                    canvas.toBlob(resolve, 'image/png')
                );
                zip.file(
                    `${symbol.toLowerCase()}_${dateForFilename}.png`,
                    blob
                );
            } catch (error) {
                console.error(
                    `Failed to capture thumbnail for ${symbol}:`,
                    error
                );
            }
        }

        try {
            const zipBlob = await zip.generateAsync({ type: 'blob' });
            const link = document.createElement('a');
            link.href = URL.createObjectURL(zipBlob);
            link.download = `thumbnails_${dateForFilename}.zip`;
            link.click();
            URL.revokeObjectURL(link.href);
        } catch (error) {
            console.error('Failed to generate zip file:', error);
        } finally {
            isDownloading.value = false;
        }
    };
</script>

<template>
    <div class="thumbnail-batch-page">
        <header class="batch-header">
            <div class="flex align-items-center gap-3">
                <Checkbox v-model="isAllSelected" :binary="true" />
                <h1>
                    썸네일 일괄 생성 ({{ selectedThumbnails.length }} /
                    {{ allThumbnailsData.length }})
                </h1>
            </div>
            <div class="flex align-items-center gap-3">
                <SelectButton
                    v-if="groups.length > 1"
                    v-model="selectedGroup"
                    :options="groups" />
                <InputText v-model="date" placeholder="YY. MM. DD" />
                <Button
                    label="선택 이미지 다운로드"
                    icon="pi pi-download"
                    @click="downloadImages"
                    :loading="isDownloading"
                    :disabled="isLoading || selectedThumbnails.length === 0" />
            </div>
        </header>

        <main class="preview-grid">
            <div v-if="isLoading" class="loading-spinner">
                <ProgressSpinner />
                <p>썸네일 데이터 로딩 중...</p>
            </div>
            <div
                v-else
                v-for="thumb in filteredThumbnails"
                :key="thumb.symbol"
                :data-symbol="thumb.symbol"
                class="thumbnail-wrapper">
                <Checkbox
                    v-model="selectedThumbnails"
                    :value="thumb.symbol"
                    class="thumbnail-checkbox" />
                <ThumbnailItem :data="{ ...thumb, date }" />
            </div>
        </main>
    </div>
</template>
