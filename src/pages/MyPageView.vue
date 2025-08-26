<!-- src\pages\MyPageView.vue -->
<script setup>
    import { ref, computed } from 'vue';
    import { useHead } from '@vueuse/head';

    import TabView from 'primevue/tabview';
    import TabPanel from 'primevue/tabpanel';

    // 각 탭에 해당하는 컴포넌트들을 import 합니다.
    import ProfileSettings from '@/components/mypage/ProfileSettings.vue';
    import BookmarkManager from '@/components/mypage/BookmarkManager.vue';
    // import AssetManager from '@/components/mypage/AssetManager.vue';

    const activeTabIndex = ref(0);

    const tabTitles = [
        '북마크',
        // '보유자산 관리', // 주석 처리된 탭이므로 배열에서도 제외
        '회원정보 수정',
    ];

    const pageTitle = computed(() => tabTitles[activeTabIndex.value]);

    useHead({
        title: pageTitle,
    });
</script>

<template>
    <div id="t-mypage">
        <TabView>
            <TabPanel header="북마크">
                <BookmarkManager />
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
