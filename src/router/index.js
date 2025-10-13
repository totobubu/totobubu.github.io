// REFACTORED: src/router/index.js
import { createRouter, createWebHistory } from 'vue-router';
import HomeView from '../pages/HomeView.vue';
import CalendarView from '../pages/CalendarView.vue';
import BacktesterView from '../pages/BacktesterView.vue';
import StockView from '../pages/StockView.vue';
import SignUpView from '../pages/SignupView.vue';
import LoginView from '../pages/LoginView.vue';
import PasswordResetView from '../pages/PasswordResetView.vue';
import MyPageView from '../pages/MyPageView.vue';
import ContactView from '../pages/ContactView.vue';
import NotFound from '../pages/NotFound.vue';
import ThumbnailGenerator from '../pages/ThumbnailGenerator.vue'; // [추가]
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
        {
            path: '/mypage',
            name: 'mypage',
            component: MyPageView,
            meta: { requiresAuth: true },
        },
        {
            path: '/thumbnail-generator',
            name: 'thumbnail-generator',
            component: ThumbnailGenerator,
        },
        {
            path: '/contact',
            name: 'contact',
            component: ContactView,
        },
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
    const isAuthPage = ['login', 'signup', 'password-reset'].includes(to.name);
    const user = await getCurrentUser();

    if (requiresAuth && !user) {
        next({ name: 'login', query: { redirect: to.fullPath } });
    } else if (isAuthPage && user) {
        next({ name: 'mypage' });
    } else {
        next();
    }
});

export default router;
