<!-- stock\src\layouts\Layout.vue -->
<script setup>
    import { ref, watch, computed, onMounted } from 'vue';
    import { RouterView, useRoute } from 'vue-router';
    import AppSidebar from './AppSidebar.vue';
    // import TickerSelector from '@/components/CalendarTickerSelector.vue';
    import FilterInput from '@/components/FilterInput.vue';
    import Drawer from 'primevue/drawer';
    import Button from 'primevue/button';
    import Breadcrumb from 'primevue/breadcrumb';
    import { useFilterState } from '@/composables/useFilterState';
    import { useBreakpoint } from '@/composables/useBreakpoint';
    import { useCalendarData } from '@/composables/useCalendarData.js';
    import { useStockData } from '@/composables/useStockData.js';

    const { deviceType, isDesktop, isMobile } = useBreakpoint();
    const { filters, showMyStocksOnly } = useFilterState();
    const { loadAllData } = useCalendarData();
    const { tickerInfo } = useStockData();

    const router = useRouter();
    import { signOut } from 'firebase/auth';
    import { auth } from '../firebase';
    // 1. 스토어에서 user 상태를 가져옵니다.
    import { user } from '../store/auth';

    const visible = ref(false);
    const visible2 = ref(false);
    const route = useRoute();
    const isHomePage = computed(() => route.path === '/');
    const isLogin = computed(() => route.path === '/login');
    const isSignup = computed(() => route.path === '/signup');

    onMounted(() => {
        loadAllData();
    });

    // 2. 로그인/로그아웃 함수를 만듭니다.
    const goToLogin = () => {
        router.push('/login');
    };
    const onLogout = async () => {
        try {
            await signOut(auth);
            alert('로그아웃 되었습니다.');

            // router.push('/login'); // 이 부분을 아래와 같이 수정합니다.
            router.push('/'); // 홈으로 이동
        } catch (error) {
            console.error('로그아웃 실패:', error);
        }
    };

    const breadcrumbItems = computed(() => {
        const home = { icon: 'pi pi-home', to: '/' };
        const items = [];

        if (route.name === 'stock-detail' && tickerInfo.value) {
            if (isDesktop.value) {
                // 데스크탑 뷰: 심볼 -> 긴 이름
                if (tickerInfo.value.Symbol) {
                    items.push({ label: tickerInfo.value.Symbol });
                }
                if (tickerInfo.value.longName) {
                    items.push({
                        label: tickerInfo.value.longName,
                    });
                }
            } else {
                // 모바일/태블릿 뷰: 회사 -> 심볼
                if (
                    tickerInfo.value.company &&
                    tickerInfo.value.company !== 'N/A'
                ) {
                    items.push({ label: tickerInfo.value.company });
                    items.push({
                        label: tickerInfo.value.Symbol,
                    });
                } else {
                    items.push({ label: tickerInfo.value.Symbol });
                }
            }
        }
        return [home, ...items];
    });

    watch(visible, (newValue) => {
        if (newValue) document.body.classList.add('p-overflow-hidden');
        else document.body.classList.remove('p-overflow-hidden');
    });

    watch(
        () => route.path,
        () => {
            visible.value = false;
            visible2.value = false;
        }
    );
</script>

<template>
    <div id="t-layout">
        <aside id="t-sidebar" v-if="deviceType === 'desktop'">
            <header>
                <!-- 검색창을 하나로 통일 -->
                <FilterInput
                    v-model="filters.global.value"
                    title="전체 티커 검색"
                    filter-type="global" />
            </header>
            <AppSidebar />
        </aside>

        <main id="t-grid">
            <header id="t-header">
                <div
                    class="flex items-center gap-4 min-w-0"
                    v-if="!isHomePage && tickerInfo">
                    <Breadcrumb :model="breadcrumbItems" id="t-breadcrumb">
                        <template #item="{ item }">
                            <router-link
                                v-if="item.to"
                                :to="item.to"
                                class="p-menuitem-link">
                                <span
                                    v-if="item.icon"
                                    :class="item.icon"></span>
                                <span
                                    class="font-semibold"
                                    :class="{
                                        'text-primary': route.path === item.to,
                                    }"
                                    >{{ item.label }}</span
                                >
                            </router-link>
                            <span
                                v-else
                                class="text-surface-500 dark:text-surface-400"
                                >{{ item.label }}</span
                            >
                        </template>
                    </Breadcrumb>
                </div>
                <p class="text font-bold" v-else-if="isHomePage">배당금 일정</p>
                <div
                    id="t-topbar"
                    class="topbar-actions"
                    v-if="!isLogin && !isSignup">
                    <!-- 사용자가 없을 때 (로그아웃 상태) -->
                    <Button
                        v-if="!user"
                        icon="pi pi-sign-in"
                        variant="text"
                        @click="goToLogin"
                        aria-label="로그인" />

                    <!-- 사용자가 있을 때 (로그인 상태) -->
                    <Button
                        v-else
                        icon="pi pi-sign-out"
                        variant="text"
                        @click="onLogout"
                        aria-label="로그아웃" />
                    <Button
                        v-if="deviceType !== 'desktop'"
                        icon="pi pi-bars"
                        variant="text"
                        @click="visible = true" />
                </div>
            </header>
            <section id="t-content">
                <RouterView />
                <ScrollTop
                    v-if="!isHomePage"
                    target="parent"
                    :threshold="100"
                    icon="pi pi-arrow-up"
                    :buttonProps="{
                        severity: 'contrast',
                        raised: true,
                        rounded: true,
                    }" />
            </section>
        </main>

        <Drawer
            v-if="deviceType !== 'desktop'"
            v-model:visible="visible"
            :position="isMobile ? 'full' : 'right'"
            :modal="true"
            id="toto-search"
            :class="deviceType">
            <template #header>
                <FilterInput
                    v-model="filters.global.value"
                    title="전체 티커 검색"
                    filter-type="global" />
            </template>
            <AppSidebar />
        </Drawer>
    </div>
</template>
