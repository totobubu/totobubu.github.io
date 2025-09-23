<!-- stock\src\pages\HomeView.vue -->
<script setup>
    import { useHead } from '@vueuse/head';
    import { useRouter } from 'vue-router';
    import Button from 'primevue/button'; // PrimeVue Button import

    const router = useRouter();

    useHead({
        title: '홈', // 홈페이지의 기본 타이틀
    });
</script>

<template>
    <header class="t-home-header">
        <h1>배당모아 Div Grow</h1>
    </header>

    <div class="p-4">
        <div class="grid">
            <div class="col-12 md:col-6">
                <div class="surface-card shadow-2 p-4 border-round">
                    <div class="text-xl font-medium text-900 mb-3">
                        배당달력
                    </div>
                    <p
                        class="mt-0 mb-3 line-height-3 text-surface-700 dark:text-surface-200">
                        전체 티커의 월별 배당 일정을 확인하고 나만의
                        포트폴리오를 관리하세요.
                    </p>
                    <Button
                        label="달력 보러가기"
                        icon="pi pi-calendar"
                        @click="router.push('/calendar')" />
                </div>
            </div>
            <div class="col-12 md:col-6">
                <div class="surface-card shadow-2 p-4 border-round">
                    <div class="text-xl font-medium text-900 mb-3">
                        마이페이지
                    </div>
                    <p
                        class="mt-0 mb-3 line-height-3 text-surface-700 dark:text-surface-200">
                        북마크한 종목을 관리하고, 포트폴리오 백테스팅을 통해
                        투자 전략을 시뮬레이션 해보세요.
                    </p>
                    <Button
                        label="마이페이지로 이동"
                        icon="pi pi-user"
                        severity="secondary"
                        @click="router.push('/mypage')" />
                </div>
            </div>
            <!-- 앞으로 새로운 위젯을 여기에 추가할 수 있습니다. -->
        </div>
    </div>
</template>
