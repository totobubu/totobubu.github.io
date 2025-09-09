<!-- stock\src\pages\HomeView.vue -->
<script setup>
    import { ref, onMounted, computed } from 'vue';
    import { useHead } from '@vueuse/head';
    import { useRouter } from 'vue-router';
    import { user } from '@/store/auth';
    import Card from 'primevue/card';
    import Button from 'primevue/button';
    import ProgressSpinner from 'primevue/progressspinner';
    import { joinURL } from 'ufo';
    import { format as formatDate } from 'date-fns';

    useHead({
        title: '배당모아 | 나만의 배당 포트폴리오 관리',
    });

    const router = useRouter();
    const isLoading = ref(true);
    const highlightedStocks = ref([]);

    // "오늘의 주요 배당주" 정보를 가져오는 로직
    const fetchHighlightedStocks = async () => {
        try {
            const today = new Date();
            const nextWeek = new Date();
            nextWeek.setDate(today.getDate() + 7);

            const todayStr = formatDate(today, 'yyyy-MM-dd');
            const nextWeekStr = formatDate(nextWeek, 'yyyy-MM-dd');

            // 이 API는 아직 없으므로, 생성해야 합니다.
            // 우선은 nav.json과 data 폴더를 활용하여 클라이언트 측에서 구현합니다.
            const navResponse = await fetch(
                joinURL(import.meta.env.BASE_URL, 'nav.json')
            );
            const navData = await navResponse.json();

            const upcomingDividends = [];
            for (const stock of navData.nav) {
                if (stock.upcoming) continue;

                const dataUrl = joinURL(
                    import.meta.env.BASE_URL,
                    `data/${stock.symbol.toLowerCase()}.json`
                );
                const stockDataRes = await fetch(dataUrl);
                if (stockDataRes.ok) {
                    const stockData = await stockDataRes.json();
                    if (stockData.dividendHistory) {
                        const nextDividend = stockData.dividendHistory.find(
                            (div) => {
                                const divDate = `20${div.배당락.split('.').join('-').replace(/\s/g, '')}`;
                                return (
                                    divDate >= todayStr &&
                                    divDate <= nextWeekStr
                                );
                            }
                        );
                        if (nextDividend) {
                            upcomingDividends.push({
                                symbol: stock.symbol,
                                longName: stock.longName || stock.symbol,
                                exDividendDate: `20${nextDividend.배당락.split('.').join('-').replace(/\s/g, '')}`,
                                dividend: nextDividend.배당금,
                                logo: stock.logo,
                            });
                        }
                    }
                }
            }

            // 간단한 예시: 다가오는 배당주 중 3개만 무작위로 보여주기
            highlightedStocks.value = upcomingDividends
                .sort(() => 0.5 - Math.random())
                .slice(0, 3);
        } catch (error) {
            console.error('하이라이트 종목을 불러오는 데 실패했습니다:', error);
        } finally {
            isLoading.value = false;
        }
    };

    onMounted(() => {
        fetchHighlightedStocks();
    });

    const authCard = computed(() => {
        if (user.value) {
            return {
                title: '마이페이지',
                icon: 'pi pi-user',
                description: '내 자산 현황 확인하고, 포트폴리오를 관리하세요.',
                path: '/mypage',
            };
        }
        return {
            title: '로그인 / 회원가입',
            icon: 'pi pi-sign-in',
            description: '가입하고 나만의 배당 포트폴리오를 만들어보세요.',
            path: '/login',
        };
    });
</script>

<template>
    <div class="p-4 md:p-6">
        <!-- 0. 사이트 이름 강조 -->
        <div class="text-center mb-8">
            <h1 class="text-5xl font-bold text-primary">배당모아</h1>
            <p class="text-xl text-surface-600 dark:text-surface-400 mt-2">
                나만의 배당 파이프라인을 구축하고 관리하는 가장 쉬운 방법
            </p>
        </div>

        <!-- 1, 2, 3. 핵심 기능 카드 링크 -->
        <div class="grid">
            <div class="col-12 md:col-6 lg:col-4">
                <Card
                    class="h-full feature-card cursor-pointer"
                    @click="router.push('/calendar')">
                    <template #header>
                        <div
                            class="flex justify-content-center p-4 text-primary">
                            <i class="pi pi-calendar text-6xl"></i>
                        </div>
                    </template>
                    <template #title>배당 달력</template>
                    <template #subtitle
                        >전체 종목의 배당 일정을 한눈에 확인하세요.</template
                    >
                    <template #content>
                        <p>
                            언제, 어떤 종목이 배당을 지급하는지 월별 달력으로
                            쉽게 파악하고 투자 계획을 세울 수 있습니다.
                        </p>
                    </template>
                </Card>
            </div>

            <div class="col-12 md:col-6 lg:col-4">
                <Card
                    class="h-full feature-card cursor-pointer"
                    @click="router.push('/backtester')">
                    <template #header>
                        <div
                            class="flex justify-content-center p-4 text-primary">
                            <i class="pi pi-chart-line text-6xl"></i>
                        </div>
                    </template>
                    <template #title>포트폴리오 백테스터</template>
                    <template #subtitle
                        >과거 데이터로 미래 성과를 예측해보세요.</template
                    >
                    <template #content>
                        <p>
                            관심 있는 종목들로 가상 포트폴리오를 구성하고,
                            배당금 재투자 여부에 따른 수익률 변화를 시뮬레이션
                            할 수 있습니다.
                        </p>
                    </template>
                </Card>
            </div>

            <div class="col-12 md:col-6 lg:col-4">
                <Card
                    class="h-full feature-card cursor-pointer"
                    @click="router.push(authCard.path)">
                    <template #header>
                        <div
                            class="flex justify-content-center p-4 text-primary">
                            <i :class="authCard.icon" class="text-6xl"></i>
                        </div>
                    </template>
                    <template #title>{{ authCard.title }}</template>
                    <template #subtitle
                        >나만의 관심 종목을 관리하고 분석하세요.</template
                    >
                    <template #content>
                        <p>{{ authCard.description }}</p>
                    </template>
                </Card>
            </div>
        </div>

        <!-- 4. 오늘의 주요 배당주 정보 -->
        <div class="mt-8">
            <h2 class="text-3xl font-bold mb-4">이번 주 주요 배당락 종목</h2>
            <div v-if="isLoading" class="flex justify-content-center p-4">
                <ProgressSpinner />
            </div>
            <div v-else-if="highlightedStocks.length > 0" class="grid">
                <div
                    v-for="stock in highlightedStocks"
                    :key="stock.symbol"
                    class="col-12 md:col-4">
                    <Card class="highlight-card">
                        <template #title>
                            <div class="flex align-items-center gap-3">
                                <img
                                    v-if="stock.logo"
                                    :src="stock.logo"
                                    class="w-3rem h-3rem border-circle" />
                                <div class="flex flex-column">
                                    <span class="font-bold text-lg">{{
                                        stock.symbol
                                    }}</span>
                                    <small class="text-surface-500">{{
                                        stock.longName
                                    }}</small>
                                </div>
                            </div>
                        </template>
                        <template #content>
                            <div
                                class="flex justify-content-between align-items-center">
                                <div>
                                    <p class="m-0 text-surface-500">배당락일</p>
                                    <p class="m-0 font-semibold text-lg">
                                        {{ stock.exDividendDate }}
                                    </p>
                                </div>
                                <div>
                                    <p class="m-0 text-surface-500">
                                        예상 배당금
                                    </p>
                                    <p class="m-0 font-semibold text-lg">
                                        {{ stock.dividend }}
                                    </p>
                                </div>
                            </div>
                        </template>
                        <template #footer>
                            <Button
                                label="상세 정보 보기"
                                icon="pi pi-arrow-right"
                                iconPos="right"
                                text
                                @click="
                                    router.push(
                                        `/${stock.symbol.toLowerCase()}`
                                    )
                                "></Button>
                        </template>
                    </Card>
                </div>
            </div>
            <div v-else class="text-center p-4 surface-card border-round">
                <p class="text-surface-500">
                    이번 주에 예정된 주요 배당락 정보가 없습니다.
                </p>
            </div>
        </div>
    </div>
</template>

<style scoped>
    .feature-card {
        transition: all 0.2s ease-in-out;
        border: 1px solid transparent;
    }
    .feature-card:hover {
        transform: translateY(-5px);
        border-color: var(--p-primary-color);
        box-shadow: 0 4px 20px var(--p-primary-200);
    }
    .dark .feature-card:hover {
        box-shadow: 0 4px 20px rgba(var(--p-primary-400-rgb), 0.3);
    }
    .highlight-card .p-card-title {
        margin-bottom: 0;
    }
</style>
