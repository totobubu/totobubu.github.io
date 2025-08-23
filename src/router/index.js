// src/router/index.js

import { createRouter, createWebHistory } from 'vue-router';
import HomeView from '../pages/HomeView.vue';
import StockView from '../pages/StockView.vue'; // 개별 주식 정보를 보여줄 컴포넌트
import SignUpView from '../pages/SignupView.vue';
import LoginView from '../pages/LoginView.vue';
import PasswordResetView from '../pages/PasswordResetView.vue';
import MyPageView from '../pages/MyPageView.vue';
import NotFound from '../pages/NotFound.vue';
import { auth } from '../firebase';
import { onAuthStateChanged } from 'firebase/auth'; // onAuthStateChanged 추가

// --- 헬퍼 함수 추가 ---
// 이 함수는 Firebase 인증 상태가 완전히 로드될 때까지 기다려줍니다.
const getCurrentUser = () => {
    return new Promise((resolve, reject) => {
        const unsubscribe = onAuthStateChanged(
            auth,
            (user) => {
                unsubscribe(); // 리스너를 한 번만 실행하고 해제합니다.
                resolve(user);
            },
            reject
        );
    });
};
// --------------------

const router = createRouter({
    // ... routes 배열은 그대로 ...
    history: createWebHistory(import.meta.env.BASE_URL),
    routes: [
        {
            path: '/',
            name: 'home',
            component: HomeView,
        },
        {
            path: '/:ticker', // :ticker 부분이 변수 역할을 합니다.
            name: 'stock-detail',
            component: StockView,
            props: true, // 경로의 파라미터(:ticker)를 컴포넌트의 props로 전달
        },
        {
            path: '/:pathMatch(.*)*', // 정규표현식을 사용해 모든 경로를 잡음
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
            meta: { requiresAuth: true }, // 로그인이 필요한 페이지로 설정
        },
    ],
});

router.beforeEach(async (to, from, next) => {
    const requiresAuth = to.matched.some(record => record.meta.requiresAuth);
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
