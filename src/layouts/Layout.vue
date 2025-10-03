<script setup>
    import { ref, watch, computed } from 'vue';
    import { RouterView, useRoute, useRouter } from 'vue-router';
    import { useFilterState } from '@/composables/useFilterState';
    import { useBreakpoint } from '@/composables/useBreakpoint';
    import { handleSignOut, user } from '../store/auth';
    import { useStockData } from '@/composables/useStockData';

    import Menu from 'primevue/menu';
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

    const breadcrumbItems = computed(() => {
        const home = { icon: 'pi pi-home', to: '/' };
        const items = [];

        if (route.name === 'calendar') items.push({ label: '배당달력' });
        else if (route.name === 'backtester') items.push({ label: '백테스터' });
        else if (route.name === 'bookmarks')
            items.push({ label: '북마크 관리' });
        else if (route.name === 'profile')
            items.push({ label: '회원정보 수정' });
        else if (route.name === 'stock-detail' && tickerInfo.value) {
            const displayName =
                tickerInfo.value.koName ||
                tickerInfo.value.symbol?.toUpperCase();
            if (displayName) {
                items.push({ label: displayName });
            }
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

    const menu = ref();

    const onLogout = async () => {
        try {
            await handleSignOut();
            router.push('/');
        } catch (error) {
            console.error('로그아웃 실패:', error);
        }
    };

    const overlayMenuItems = computed(() => {
        const items = [
            {
                label: '배당달력',
                icon: 'pi pi-calendar',
                command: () => router.push('/calendar'),
            },
            {
                label: '백테스터',
                icon: 'pi pi-history',
                command: () => router.push('/backtester'),
            },
            { separator: true },
        ];

        if (user.value) {
            items.push({
                label: '북마크 관리',
                icon: 'pi pi-bookmark',
                command: () => router.push('/bookmarks'),
            });
            items.push({
                label: '회원정보 수정',
                icon: 'pi pi-user-edit',
                command: () => router.push('/profile'),
            });
            items.push({
                label: '로그아웃',
                icon: 'pi pi-sign-out',
                command: onLogout,
            });
        } else {
            items.push({
                label: '로그인',
                icon: 'pi pi-sign-in',
                command: () => router.push('/login'),
            });
        }
        return items;
    });

    const toggleMenu = (event) => {
        menu.value.toggle(event);
    };
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
                                class="text-surface-500 dark:text-surface-400"
                                >{{ item.label }}</span
                            >
                        </template>
                    </Breadcrumb>
                </div>

                <div id="t-topbar" class="topbar-actions">
                    <Button
                        type="button"
                        icon="pi pi-ellipsis-v"
                        text
                        @click="toggleMenu"
                        aria-haspopup="true"
                        aria-controls="overlay_menu"
                        class="p-button-plain" />
                    <Menu
                        ref="menu"
                        id="overlay_menu"
                        :model="overlayMenuItems"
                        :popup="true" />
                    <Button
                        v-if="!isDesktop"
                        icon="pi pi-bars"
                        variant="text"
                        @click="visible = true"
                        aria-label="사이드바 열기" />
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
