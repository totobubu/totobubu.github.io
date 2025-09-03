<!-- src\pages\MyPageView.vue -->
<script setup>
    import { ref, computed } from 'vue';
    import { useHead } from '@vueuse/head';
    import TabView from 'primevue/tabview';
    import TabPanel from 'primevue/tabpanel';
    import Toast from 'primevue/toast';
    import ProfileSettings from '@/components/mypage/ProfileSettings.vue';
    import BookmarkManager from '@/components/mypage/BookmarkManager.vue';
    import PortfolioBacktester from '@/components/mypage/PortfolioBacktester.vue';
    // import AssetManager from '@/components/mypage/AssetManager.vue';

    const activeTabIndex = ref(0);
    const tabTitles = ['북마크 & 백테스터', '회원정보 수정'];

    const pageTitle = computed(() => {
        const currentTabName = tabTitles[activeTabIndex.value] || '마이페이지';
        return `${currentTabName} | 마이페이지`;
    });

    useHead({
        title: pageTitle,
    });

    const backtesterRef = ref(null);

    const handleSelection = (selection) => {
        if (backtesterRef.value) {
            backtesterRef.value.handleSelectionChange(selection);
        }
    };
</script>

<template>
    <div id="t-mypage">
        <Toast />
        <TabView v-model:activeIndex="activeTabIndex">
            <TabPanel header="북마크 & 백테스터">
                <PortfolioBacktester ref="backtesterRef" />
                <div class="mt-4">
                    <BookmarkManager @selection-change="handleSelection" />
                </div>
            </TabPanel>
            <!-- <TabPanel header="보유자산 관리">
                <AssetManager />
            </TabPanel> -->
            <TabPanel header="회원정보 수정">
                <ProfileSettings />
            </TabPanel>
        </TabView>
    </div>
</template>
