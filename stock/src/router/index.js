import { createRouter, createWebHistory } from 'vue-router'
import HomeView from '../pages/HomeView.vue'
import StockView from '../pages/StockView.vue' // 개별 주식 정보를 보여줄 컴포넌트
import NotFound from '../pages/NotFound.vue'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      name: 'home',
      component: HomeView,
    },
    // 동적 경로: /stock/tsly, /stock/ymax 와 같은 모든 경로를 처리
    {
      path: '/stock/:ticker', // :ticker 부분이 변수 역할을 합니다.
      name: 'stock-detail',
      component: StockView,
      props: true // 경로의 파라미터(:ticker)를 컴포넌트의 props로 전달
    },
    {
      path: '/:pathMatch(.*)*', // 정규표현식을 사용해 모든 경로를 잡음
      name: 'NotFound',
      component: NotFound
    }
  ],
})

export default router