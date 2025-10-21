// src/router/index.js
import { createRouter, createWebHistory } from 'vue-router';
import HomeView from '../pages/HomeView.vue';
import CalendarView from '../pages/CalendarView.vue';
import BacktesterView from '../pages/BacktesterView.vue';
// import BacktesterViewKR from '../pages/BacktesterViewKR.vue';
import StockView from '../pages/StockView.vue';
import SignUpView from '../pages/SignupView.vue';
import LoginView from '../pages/LoginView.vue';
import PasswordResetView from '../pages/PasswordResetView.vue';
// import MyPageView from '../pages/MyPageView.vue'; // [삭제]
import BookmarkView from '../pages/BookmarkView.vue';
import ProfileView from '../pages/ProfileView.vue';
import ContactView from '../pages/ContactView.vue';
import NotFound from '../pages/NotFound.vue';
import ThumbnailGenerator from '../pages/ThumbnailGenerator.vue';
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
        // {
        //     path: '/backtester-kr/:ticker?',
        //     name: 'backtester-kr',
        //     component: BacktesterViewKR,
        //     props: true,
        // },
        { path: '/signup', name: 'signup', component: SignUpView },
        { path: '/login', name: 'login', component: LoginView },
        {
            path: '/password-reset',
            name: 'password-reset',
            component: PasswordResetView,
        },
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
        next({ name: 'bookmarks' }); // 로그인/회원가입 페이지에 이미 로그인된 사용자가 접근 시 /bookmarks 로 이동
    } else {
        next();
    }
});

export default router;