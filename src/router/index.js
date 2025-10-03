// REFACTORED: src/router/index.js

import { createRouter, createWebHistory } from 'vue-router';
import HomeView from '../pages/HomeView.vue';
import CalendarView from '../pages/CalendarView.vue';
import BacktesterView from '../pages/BacktesterView.vue';
import StockView from '../pages/StockView.vue';
import SignUpView from '../pages/SignupView.vue';
import LoginView from '../pages/LoginView.vue';
import PasswordResetView from '../pages/PasswordResetView.vue';
// MyPageView를 import하는 대신 새로운 페이지 컴포넌트를 import합니다.
import BookmarkView from '../pages/BookmarkView.vue';
import ProfileView from '../pages/ProfileView.vue';
import NotFound from '../pages/NotFound.vue';
import { auth } from '../firebase';
import { onAuthStateChanged } from 'firebase/auth';

const getCurrentUser = () => {
    return new Promise((resolve, reject) => {
        const unsubscribe = onAuthStateChanged(
            auth,
            (user) => {
                unsubscribe();
                resolve(user);
            },
            reject
        );
    });
};

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
        { path: '/signup', name: 'signup', component: SignUpView },
        { path: '/login', name: 'login', component: LoginView },
        {
            path: '/password-reset',
            name: 'password-reset',
            component: PasswordResetView,
        },

        // --- [핵심 수정] ---
        // MyPageView 경로를 제거하고, 새로운 두 경로를 추가합니다.
        {
            path: '/bookmarks',
            name: 'bookmarks',
            component: BookmarkView,
            meta: { requiresAuth: true },
        },
        {
            path: '/profile',
            name: 'profile',
            component: ProfileView,
            meta: { requiresAuth: true },
        },
        // --- // ---

        {
            path: '/:ticker',
            name: 'stock-detail',
            component: StockView,
            props: true,
        },
        { path: '/:pathMatch(.*)*', name: 'NotFound', component: NotFound },
    ],
});

router.beforeEach(async (to, from, next) => {
    const requiresAuth = to.matched.some((record) => record.meta.requiresAuth);
    // isAuthPage 조건에서 mypage 제거
    const isAuthPage = ['login', 'signup', 'password-reset'].includes(to.name);
    const user = await getCurrentUser();

    if (requiresAuth && !user) {
        next({ name: 'login', query: { redirect: to.fullPath } });
    } else if (isAuthPage && user) {
        // 로그인한 상태에서 로그인/가입 페이지 접근 시, 홈 대신 북마크 페이지로 보냅니다.
        next({ name: 'bookmarks' });
    } else {
        next();
    }
});

export default router;
