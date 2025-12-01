// src/router/index.js
import { createRouter, createWebHistory } from 'vue-router';
import { auth } from '../firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { buildRouteParamsFromLegacyTicker } from '@/utils/tickerRoute';

// 홈 페이지는 즉시 로드 (초기 화면)
import HomeView from '../pages/HomeView.vue';

// 나머지 페이지는 lazy loading으로 필요할 때만 로드
import { ADMIN_EMAILS, isAdminEmail } from '@/config/admin';

const CalendarView = () => import('../pages/CalendarView.vue');
const BacktesterView = () => import('../pages/BacktesterView.vue');
const StockView = () => import('../pages/StockView.vue');
const SignUpView = () => import('../pages/SignupView.vue');
const LoginView = () => import('../pages/LoginView.vue');
const PasswordResetView = () => import('../pages/PasswordResetView.vue');
const BookmarkView = () => import('../pages/BookmarkView.vue');
const AssetView = () => import('../pages/AssetView.vue');
const AdminView = () => import('../pages/AdminView.vue');
const AdminMigrationPage = () => import('../pages/AdminMigrationPage.vue');
const ProfileView = () => import('../pages/ProfileView.vue');
const ContactView = () => import('../pages/ContactView.vue');
const NotFound = () => import('../pages/NotFound.vue');
const ThumbnailGenerator = () => import('../pages/ThumbnailGenerator.vue');
const BlogGeneratorView = () => import('../pages/BlogGeneratorView.vue');

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
            path: '/assets',
            name: 'assets',
            component: AssetView,
            meta: { requiresAuth: true, adminOnly: true },
        },
        {
            path: '/admin',
            name: 'admin',
            component: AdminView,
            meta: { requiresAuth: true, adminOnly: true },
        },
        {
            path: '/admin/migration',
            name: 'admin-migration',
            component: AdminMigrationPage,
            meta: { requiresAuth: true, adminOnly: true },
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
            path: '/blog-generator',
            name: 'blog-generator',
            component: BlogGeneratorView,
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
        { path: '/:pathMatch(.*)*', name: 'NotFound', component: NotFound },
    ],
});

router.beforeEach(async (to, from, next) => {
    const requiresAuth = to.matched.some((record) => record.meta.requiresAuth);
    const isAuthPage = ['login', 'signup', 'password-reset'].includes(to.name);
    const user = await getCurrentUser();
    const isAdminUser = !!user && isAdminEmail(user.email || '');
    const requiresAdmin = to.matched.some((record) => record.meta.adminOnly);

    if (requiresAuth && !user) {
        next({ name: 'login', query: { redirect: to.fullPath } });
    } else if (requiresAdmin && !isAdminUser) {
        next({ name: 'bookmarks' });
    } else if (isAuthPage && user) {
        next({ name: 'bookmarks' }); // 로그인/회원가입 페이지에 이미 로그인된 사용자가 접근 시 /bookmarks 로 이동
    } else {
        next();
    }
});

export default router;
