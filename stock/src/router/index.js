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
            path: '/stock/:ticker', // :ticker 부분이 변수 역할을 합니다.
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

// beforeEach를 async 함수로 변경합니다.
router.beforeEach(async (to, from, next) => {
    const requiresAuth = to.matched.some((record) => record.meta.requiresAuth);
    const user = await getCurrentUser(); // 여기서 인증 상태를 기다립니다.

    if (requiresAuth && !user) {
        // 로그인이 필요한 페이지인데 사용자가 없는 경우
        next('/login');
    } else if ((to.name === 'login' || to.name === 'signup') && user) {
        // 이미 로그인한 사용자가 로그인/회원가입 페이지로 가려고 할 때
        next('/'); // 홈으로 리디렉션
    } else {
        // 그 외 모든 경우
        next();
    }
});

export default router;
