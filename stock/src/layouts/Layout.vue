<script setup>
    import { ref, watch, computed, onMounted, inject } from 'vue';
    import { RouterView, useRoute, useRouter } from 'vue-router';
    import AppSidebar from './AppSidebar.vue';
    import FilterInput from '@/components/FilterInput.vue';
    import Drawer from 'primevue/drawer';
    import Button from 'primevue/button';
    import Breadcrumb from 'primevue/breadcrumb';
    import Toast from 'primevue/toast';
    import ConfirmDialog from 'primevue/confirmdialog';
    import ScrollTop from 'primevue/scrolltop';
    import { useFilterState } from '@/composables/useFilterState';
    import { useBreakpoint } from '@/composables/useBreakpoint';
    import { useCalendarData } from '@/composables/useCalendarData.js';
    import { handleSignOut, user } from '../store/auth';
    import { useStockData } from '@/composables/useStockData';

    const route = useRoute();
    const router = useRouter();
    const { deviceType, isDesktop, isMobile } = useBreakpoint();
    const { filters } = useFilterState();
    const { loadAllData } = useCalendarData();
    // --- 핵심 수정: inject를 단순하게 사용하고, 기본값으로 ref(null)을 사용합니다 ---
    const { tickerInfo } = useStockData();
    // ----------------------------------------------------------------------
    const visible = ref(false);

    onMounted(() => {
        loadAllData();
    });

    const goToLogin = () => router.push('/login');
    const onLogout = async () => {
        try {
            await handleSignOut();
            router.push('/');
        } catch (error) {
            console.error('로그아웃 실패:', error);
        }
    };
    const goToMyPage = () => router.push('/mypage');

    // --- 5. 디버그 로그 추가 ---
    // inject로 받은 tickerInfo가 변경될 때마다 로그를 찍어봅니다.
    watch(
        tickerInfo,
        (newInfo) => {
            console.log(
                '[Layout.vue] inject로 받은 tickerInfo 변경 감지:',
                newInfo
            );
        },
        { deep: true }
    );
    // -------------------------

    const breadcrumbItems = computed(() => {
        const home = { icon: 'pi pi-home', to: '/' };
        const items = [];

        // inject로 받은 tickerInfo는 readonly ref이므로 여전히 .value로 접근해야 합니다.
        if (route.name === 'stock-detail' && tickerInfo.value) {
            if (tickerInfo.value.symbol)
                items.push({ label: tickerInfo.value.symbol.toUpperCase() });
            if (isDesktop.value && tickerInfo.value.longName) {
                items.push({ label: tickerInfo.value.longName });
            }
        } else if (route.name === 'mypage') {
            items.push({ label: '마이페이지' });
        }

        return [home, ...items];
    });

    watch(
        () => route.path,
        () => {
            visible.value = false;
        }
    );
</script>

<template>
    <div id="t-layout">
        <Toast />
        <ConfirmDialog />
        <aside id="t-sidebar" v-if="isDesktop">
            <header>
                <FilterInput
                    v-model="filters.global.value"
                    title="전체 티커 검색"
                    filter-type="global" />
            </header>
            <AppSidebar />
        </aside>

        <main id="t-grid">
            <header id="t-header">
                <!-- 핵심 수정: v-if 조건을 단순화하고 명확하게 만듭니다 -->
                <div v-if="route.path === '/'" class="flex items-center">
                    <p class="text-lg font-bold">배당금 일정</p>
                </div>
                <div v-else class="flex items-center gap-4 min-w-0">
                    <Breadcrumb :model="breadcrumbItems" id="t-breadcrumb">
                        <template #item="{ item, props }">
                            <router-link
                                v-if="item.to"
                                :to="item.to"
                                v-bind="props.action">
                                <span v-if="item.icon" :class="item.icon" />
                                <span class="font-semibold">{{
                                    item.label
                                }}</span>
                            </router-link>
                            <span
                                v-else
                                class="text-surface-500 dark:text-surface-400"
                                >{{ item.label }}</span
                            >
                        </template>
                    </Breadcrumb>
                </div>

                <div id="t-topbar" class="topbar-actions">
                    <Button
                        v-if="!user"
                        icon="pi pi-sign-in"
                        variant="text"
                        @click="goToLogin"
                        aria-label="로그인" />
                    <template v-else>
                        <Button
                            v-if="route.name !== 'mypage'"
                            icon="pi pi-user"
                            variant="text"
                            @click="goToMyPage"
                            aria-label="마이페이지" />
                        <Button
                            icon="pi pi-sign-out"
                            variant="text"
                            @click="onLogout"
                            aria-label="로그아웃" />
                    </template>
                    <Button
                        v-if="!isDesktop"
                        icon="pi pi-bars"
                        variant="text"
                        @click="visible = true" />
                </div>
            </header>
            <section id="t-content">
                <RouterView />
                <ScrollTop
                    v-if="route.path !== '/'"
                    target="parent"
                    :threshold="100"
                    icon="pi pi-arrow-up" />
            </section>
        </main>

        <Drawer
            v-if="!isDesktop"
            v-model:visible="visible"
            :position="isMobile ? 'full' : 'right'"
            modal
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
