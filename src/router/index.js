// src/router/index.js

import { createRouter, createWebHistory } from 'vue-router';
import HomeView from '../pages/HomeView.vue';
import CalendarView from '../pages/CalendarView.vue';
import BacktesterView from '../pages/BacktesterView.vue';
import StockView from '../pages/StockView.vue';
import SignUpView from '../pages/SignupView.vue';
import LoginView from '../pages/LoginView.vue';
import PasswordResetView from '../pages/PasswordResetView.vue';
import MyPageView from '../pages/MyPageView.vue';
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
        {
            path: '/',
            name: 'home',
            component: HomeView,
        },
        {
            path: '/calendar',
            name: 'calendar',
            component: CalendarView,
        },
        // --- [핵심 수정] ---
        // 1. backtester 라우트를 수정하고 앞으로 이동
        {
            path: '/backtester/:ticker?', // :ticker 파라미터를 선택적(optional)으로 만듬
            name: 'backtester',
            component: BacktesterView,
            props: true, // 파라미터를 props로 전달
        },
        // 2. stock-detail 라우트는 뒤에 위치
        {
            path: '/:ticker',
            name: 'stock-detail',
            component: StockView,
            props: true,
        },
        // ---
        {
            path: '/:pathMatch(.*)*',
            name: 'NotFound',
            component: NotFound,
        },
        { path: '/signup', name: 'signup', component: SignUpView },
        { path: '/login', name: 'login', component: LoginView },
        {
            path: '/password-reset',
            name: 'password-reset',
            component: PasswordResetView,
        },
        {
            path: '/mypage',
            name: 'mypage',
            component: MyPageView,
            meta: { requiresAuth: true },
        },
    ],
});

router.beforeEach(async (to, from, next) => {
    const requiresAuth = to.matched.some((record) => record.meta.requiresAuth);
    const isAuthPage = to.name === 'login' || to.name === 'signup';

    if (requiresAuth || isAuthPage) {
        const user = await getCurrentUser();

        if (requiresAuth && !user) {
            next({ name: 'login' });
        } else if (isAuthPage && user) {
            next({ name: 'home' });
        } else {
            next();
        }
    } else {
        next();
    }
});

export default router;
