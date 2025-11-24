// src/main.js

import { createApp } from 'vue';
import { createHead } from '@vueuse/head';

import App from './App.vue';
import router from './router';
import './store/auth';
import { isRecentlyAuthenticated } from './store/auth';

import PrimeVue from 'primevue/config';
import ToastService from 'primevue/toastservice';
import ConfirmationService from 'primevue/confirmationservice';
import './styles/style.scss';

// --- [핵심 수정 1] ECharts 전역 등록 ---
import { use } from 'echarts/core';
import { CanvasRenderer } from 'echarts/renderers';
import {
    BarChart,
    LineChart,
    CandlestickChart,
    PieChart,
} from 'echarts/charts';
import {
    TitleComponent,
    TooltipComponent,
    LegendComponent,
    GridComponent,
    DataZoomComponent,
    VisualMapComponent,
    MarkPointComponent,
} from 'echarts/components';

// ECharts에 필요한 모든 모듈을 등록합니다.
use([
    CanvasRenderer,
    BarChart,
    LineChart,
    CandlestickChart,
    PieChart,
    TitleComponent,
    TooltipComponent,
    LegendComponent,
    GridComponent,
    DataZoomComponent,
    VisualMapComponent,
    MarkPointComponent,
]);
// --- // ---

import { MyPreset } from '@/config/theme';

const app = createApp(App);
const head = createHead();

app.use(router);
app.use(head);
app.use(PrimeVue, {
    theme: {
        preset: MyPreset,
        options: {
            darkModeSelector: '.p-dark',
        },
    },
});
app.use(ToastService);
app.use(ConfirmationService);

router.afterEach(() => {
    isRecentlyAuthenticated.value = false;
});

app.mount('#app');
