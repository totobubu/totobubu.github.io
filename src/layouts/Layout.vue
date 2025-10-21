<!-- src/layouts/Layout.vue -->
<script setup>
    import { ref, watch, computed } from 'vue';
    import { RouterView, useRoute, useRouter } from 'vue-router';
    import { useBreakpoint } from '@/composables/useBreakpoint';
    import { handleSignOut, user } from '../store/auth'; // handleSignOut import
    import { useStockData } from '@/composables/useStockData';

    import Drawer from 'primevue/drawer';
    import Button from 'primevue/button';
    import Breadcrumb from 'primevue/breadcrumb';
    import Toast from 'primevue/toast';
    import ConfirmDialog from 'primevue/confirmdialog';
    import ScrollTop from 'primevue/scrolltop';
    import TieredMenu from 'primevue/tieredmenu';
    import AppSidebar from './AppSidebar.vue';

    const route = useRoute();
    const router = useRouter();
    const { isDesktop, isMobile } = useBreakpoint();
    const { tickerInfo } = useStockData();
    const visible = ref(false);

    const isStandalonePage = computed(() => {
        return ['/', '/thumbnail-generator'].includes(route.path);
    });

    const menu = ref();
    const toggleMenu = (event) => {
        menu.value.toggle(event);
    };


    const menuItems = computed(() => [
        {
            label: '배당달력',
            icon: 'pi pi-calendar',
            command: () => router.push('/calendar'),
        },
        {
            label: '백테스터', // [수정] 이름 변경
            icon: 'pi pi-history',
            command: () => router.push('/backtester'),
        },
        // {
        //     label: '한국 백테스터', // [추가]
        //     icon: 'pi pi-chart-line',
        //     command: () => router.push('/backtester-kr'),
        // },
        {
            label: '문의하기',
            icon: 'pi pi-envelope',
            command: () => router.push('/contact'),
        },
        { separator: true },
        ...(!user.value
            ? [
                  {
                      label: '로그인',
                      icon: 'pi pi-sign-in',
                      command: () => router.push('/login'),
                  },
              ]
            : [
                  {
                      label: '북마크',
                      icon: 'pi pi-bookmark',
                      command: () => router.push('/bookmarks'),
                  },
                  {
                      label: '회원정보 수정',
                      icon: 'pi pi-user-edit',
                      command: () => router.push('/profile'),
                  },
                  {
                      label: '로그아웃',
                      icon: 'pi pi-sign-out',
                      command: handleSignOut, // [핵심 수정] store의 함수를 직접 연결
                  },
              ]),
    ]);

    const breadcrumbItems = computed(() => {
        const home = { icon: 'pi pi-home', to: '/' };
        const items = [];

        if (route.name === 'calendar') items.push({ label: '배당달력' });
        else if (route.name === 'bookmarks')
            items.push({ label: '북마크 관리' }); // [수정]
        else if (route.name === 'profile')
            items.push({ label: '회원정보 수정' }); // [수정]
        else if (route.name === 'contact') items.push({ label: '문의하기' });
        else if (route.name === 'backtester') items.push({ label: '백테스터' });
        else if (route.name === 'stock-detail' && tickerInfo.value) {
            const info = tickerInfo.value;
            if (info.market) {
                items.push({ label: info.market.toUpperCase() });
            }

            if (isMobile.value && info.koName && info.koName !== 'N/A') {
                items.push({ label: info.koName });
            } else {
                const baseSymbol = info.symbol.split('.')[0];
                items.push({ label: baseSymbol.toUpperCase() });
            }

            const displayName =
                info.koName || info.longName || info.englishName;

            if (isDesktop.value && displayName && displayName !== 'N/A') {
                items.push({ label: displayName });
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
    <div v-if="isStandalonePage" id="t-standalone">
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
                <!-- [핵심 수정 2] Top Bar UI 통일 -->
                <div id="t-topbar" class="topbar-actions">
                    <Button
                        type="button"
                        icon="pi pi-ellipsis-v"
                        @click="toggleMenu"
                        aria-haspopup="true"
                        aria-controls="overlay_tmenu"
                        variant="text" />
                    <TieredMenu
                        ref="menu"
                        id="overlay_tmenu"
                        :model="menuItems"
                        popup />
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
            <AppSidebar />
        </aside>
        <Drawer
            v-else
            v-model:visible="visible"
            :position="isMobile ? 'full' : 'right'"
            modal
            id="toto-search">
            <AppSidebar />
        </Drawer>
    </div>
</template>