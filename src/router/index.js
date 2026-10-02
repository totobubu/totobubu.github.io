// src/router/index.js
import { createRouter, createWebHistory } from 'vue-router';
import { buildRouteParamsFromLegacyTicker } from '@/utils/tickerRoute';

// 홈 페이지는 즉시 로드 (초기 화면)
import HomeView from '../pages/HomeView.vue';

// 나머지 페이지는 lazy loading으로 필요할 때만 로드

const CalendarView = () => import('../pages/CalendarView.vue');
const BacktesterView = () => import('../pages/BacktesterView.vue');
const StockView = () => import('../pages/StockView.vue');
const BookmarkView = () => import('../pages/BookmarkView.vue');
const ContactView = () => import('../pages/ContactView.vue');
const NotFound = () => import('../pages/NotFound.vue');

const router = createRouter({
    history: createWebHistory(import.meta.env.BASE_URL),
    routes: [
        { path: '/', name: 'home', component: HomeView },
        { path: '/calendar', name: 'calendar', component: CalendarView },
        {
            path: '/backtester/:ticker?',
            name: 'backtester',
            component: BacktesterView,
            props: true,
        },
        {
            path: '/bookmark',
            name: 'bookmark-gallery',
            component: BookmarkView,
        },
        {
            path: '/contact',
            name: 'contact',
            component: ContactView,
        },
        {
            path: '/stock/:market/:ticker',
            name: 'stock-detail',
            component: StockView,
            props: true,
        },
        {
            path: '/stock/:legacyTicker',
            redirect: (to) => {
                const params = buildRouteParamsFromLegacyTicker(
                    to.params.legacyTicker
                );
                return { name: 'stock-detail', params };
            },
        },
        {
            path: '/:legacyTicker',
            redirect: (to) => {
                const params = buildRouteParamsFromLegacyTicker(
                    to.params.legacyTicker
                );
                return { name: 'stock-detail', params };
            },
        },
        {
            path: '/time-machine/:ticker?',
            name: 'time-machine',
            component: () => import('../pages/TimeMachineView.vue'),
        },
        { path: '/:pathMatch(.*)*', name: 'NotFound', component: NotFound },
    ],
});

export default router;
