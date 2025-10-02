<!-- stock\src\layouts\Layout.vue -->
<script setup>
    import { ref, watch, computed, onMounted, inject } from 'vue';
    import { RouterView, useRoute, useRouter } from 'vue-router';
    import { useFilterState } from '@/composables/useFilterState';
    import { useBreakpoint } from '@/composables/useBreakpoint';
    import { handleSignOut, user } from '../store/auth';
    import { useStockData } from '@/composables/useStockData';

    import Drawer from 'primevue/drawer';
    import Button from 'primevue/button';
    import Breadcrumb from 'primevue/breadcrumb';
    import Toast from 'primevue/toast';
    import ConfirmDialog from 'primevue/confirmdialog';
    import ScrollTop from 'primevue/scrolltop';

    import AppSidebar from './AppSidebar.vue';
    import FilterInput from '@/components/FilterInput.vue';

    const route = useRoute();
    const router = useRouter();
    const { deviceType, isDesktop, isMobile } = useBreakpoint();
    const { filters } = useFilterState();
    const { tickerInfo } = useStockData();
    const visible = ref(false);

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
    const goToBacktesterPage = () => router.push('/backtester');
    const goToCalendarPage = () => router.push('/calendar');
    const goToContactPage = () => router.push('/contact');

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

    const breadcrumbItems = computed(() => {
        const home = { icon: 'pi pi-home', to: '/' };
        const items = [];

        if (route.name === 'calendar') {
            items.push({ label: '배당달력' });
        } else if (route.name === 'mypage') {
            items.push({ label: '마이페이지' });
        } else if (route.name === 'contact') {
            items.push({ label: '문의하기' });
        } else if (route.name === 'stock-detail' && tickerInfo.value) {
            if (tickerInfo.value.symbol)
                items.push({ label: tickerInfo.value.symbol.toUpperCase() });
            if (isDesktop.value && tickerInfo.value.longName) {
                items.push({ label: tickerInfo.value.longName });
            }
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
    <div v-if="route.path === '/'" id="t-home">
        <RouterView />
    </div>
    <div v-else id="t-layout">
        <Toast />
        <ConfirmDialog />

        <main id="t-grid">
            <header id="t-header">
                <div class="flex items-center gap-4 min-w-0">
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
                                class="dark:text-surface-500 dark:text-surface-400"
                                >{{ item.label }}</span
                            >
                        </template>
                    </Breadcrumb>
                </div>

                <div id="t-topbar" class="topbar-actions">
                    <Button
                        icon="pi pi-calendar"
                        variant="text"
                        @click="goToCalendarPage"
                        aria-label="배당달력" />
                    <Button
                        icon="pi pi-history"
                        variant="text"
                        @click="goToBacktesterPage"
                        aria-label="백테스터" />
                    <Button
                        icon="pi pi-envelope"
                        variant="text"
                        @click="goToContactPage"
                        aria-label="문의하기" />
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
                    target="parent"
                    :threshold="100"
                    icon="pi pi-arrow-up" />
            </section>
        </main>
            <aside id="t-sidebar" v-if="isDesktop">
                <header>
                    <FilterInput
                        v-model="filters.global.value"
                        title="전체 티커 검색"
                        filter-type="global" />
                </header>
                <AppSidebar />
            </aside>

            <Drawer
                v-else
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
