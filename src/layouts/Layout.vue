<!-- src\layouts\Layout.vue -->
<script setup>
    import { ref, watch, computed } from 'vue';
    import { RouterView, useRoute, useRouter } from 'vue-router';
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

    const route = useRoute();
    const router = useRouter();
    const { isDesktop, isMobile } = useBreakpoint();
    const { tickerInfo } = useStockData();
    const visible = ref(false);

    const isStandalonePage = computed(() => {
        return ['/', '/thumbnail-generator'].includes(route.path);
    });

    const breadcrumbItems = computed(() => {
        const home = { icon: 'pi pi-home', to: '/' };
        const items = [];

        if (route.name === 'calendar') items.push({ label: '배당달력' });
        else if (route.name === 'mypage') items.push({ label: '마이페이지' });
        else if (route.name === 'contact') items.push({ label: '문의하기' });
        else if (route.name === 'backtester') items.push({ label: '백테스터' });
        else if (route.name === 'stock-detail' && tickerInfo.value) {
            const info = tickerInfo.value;
            if (info.market) {
                items.push({ label: info.market.toUpperCase() });
            }
            if (info.symbol) {
                const baseSymbol = info.symbol.split('.')[0]; // .KS, .KQ 제거
                items.push({ label: baseSymbol.toUpperCase() });
            }
            // longName (미국) 또는 koName (한국)
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
                <div id="t-topbar" class="topbar-actions">
                    <Button
                        icon="pi pi-calendar"
                        variant="text"
                        @click="router.push('/calendar')"
                        aria-label="배당달력" />
                    <Button
                        icon="pi pi-history"
                        variant="text"
                        @click="router.push('/backtester')"
                        aria-label="백테스터" />
                    <Button
                        icon="pi pi-envelope"
                        variant="text"
                        @click="router.push('/contact')"
                        aria-label="문의하기" />
                    <Button
                        v-if="!user"
                        icon="pi pi-sign-in"
                        variant="text"
                        @click="router.push('/login')"
                        aria-label="로그인" />
                    <template v-else>
                        <Button
                            v-if="route.name !== 'mypage'"
                            icon="pi pi-user"
                            variant="text"
                            @click="router.push('/mypage')"
                            aria-label="마이페이지" />
                        <Button
                            icon="pi pi-sign-out"
                            variant="text"
                            @click="handleSignOut"
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
