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
import { definePreset } from '@primeuix/themes';
import Lara from '@primeuix/themes/lara';

import './styles/style.scss';

// --- [핵심 수정 1] ECharts 전역 등록 ---
import { use } from 'echarts/core';
import { CanvasRenderer } from 'echarts/renderers';
import { BarChart, LineChart, CandlestickChart } from 'echarts/charts';
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
    TitleComponent,
    TooltipComponent,
    LegendComponent,
    GridComponent,
    DataZoomComponent,
    VisualMapComponent,
    MarkPointComponent,
]);
// --- // ---

// --- [핵심 수정 2] 기존 Chart.js 관련 코드 모두 삭제 ---
// ChartJS.register(...) 블록 전체를 삭제합니다.
// --- // ---

const MyPreset = definePreset(Lara, {
    // ... (기존 MyPreset 코드는 그대로 유지)
    semantic: {
        primary: {
            50: '{zinc.50}',
            100: '{zinc.100}',
            200: '{zinc.200}',
            300: '{zinc.300}',
            400: '{zinc.400}',
            500: '{zinc.500}',
            600: '{zinc.600}',
            700: '{zinc.700}',
            800: '{zinc.800}',
            900: '{zinc.900}',
            950: '{zinc.950}',
        },
        colorScheme: {
            dark: {
                primary: {
                    color: '{zinc.50}',
                    inverseColor: '{zinc.950}',
                    hoverColor: '{zinc.100}',
                    activeColor: '{zinc.200}',
                },
                highlight: {
                    background: 'rgba(250, 250, 250, .16)',
                    focusBackground: 'rgba(250, 250, 250, .24)',
                    color: 'rgba(255,255,255,.87)',
                    focusColor: 'rgba(255,255,255,.87)',
                },
                formField: {
                    hoverBorderColor: '{primary.color}',
                },
            },
        },
        focusRing: {
            width: '2px',
            style: 'dashed',
            color: '{primary.color}',
            offset: '1px',
        },
    },
    components: {
        card: {
            colorScheme: {
                dark: {
                    root: {
                        background: '{surface.900}',
                        color: '{surface.0}',
                    },
                    subtitle: {
                        color: '{surface.400}',
                    },
                },
            },
        },
    },
});

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
