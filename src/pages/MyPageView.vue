<script setup>
import TabView from 'primevue/tabview';
import TabPanel from 'primevue/tabpanel';

// 각 탭에 해당하는 컴포넌트들을 import 합니다.
import ProfileSettings from '@/components/mypage/ProfileSettings.vue';
import BookmarkManager from '@/components/mypage/BookmarkManager.vue';
// import AssetManager from '@/components/mypage/AssetManager.vue';
</script>

<template>
    <div id="t-mypage">
        <TabView>
            <TabPanel header="북마크 관리">
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
