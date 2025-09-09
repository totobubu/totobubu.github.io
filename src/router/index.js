// src/router/index.js
import { createRouter, createWebHistory } from 'vue-router';
import HomeView from '../pages/HomeView.vue';
import CalendarView from '../pages/CalendarView.vue';
import StockView from '../pages/StockView.vue';
import SignUpView from '../pages/SignupView.vue';
import LoginView from '../pages/LoginView.vue';
import PasswordResetView from '../pages/PasswordResetView.vue';
import MyPageView from '../pages/MyPageView.vue';
import NotFound from '../pages/NotFound.vue';
import BacktesterPage from '@/pages/BacktesterPage.vue';
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
            name: 'Calendar',
            component: CalendarView,
        },
        {
            path: '/:ticker',
            name: 'StockView',
            component: StockView,
            props: true,
        },
        {
            path: '/backtester',
            name: 'Backtester',
            component: BacktesterPage,
        },
        {
            path: '/mypage',
            name: 'MyPage',
            component: MyPageView,
            meta: { requiresAuth: true },
        },
        { path: '/signup', name: 'signup', component: SignUpView },
        { path: '/login', name: 'login', component: LoginView },
        {
            path: '/password-reset',
            name: 'password-reset',
            component: PasswordResetView,
        },
        {
            path: '/:pathMatch(.*)*',
            name: 'NotFound',
            component: NotFound,
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
