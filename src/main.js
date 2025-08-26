// src/main.js

import { createApp } from 'vue';
import { createHead } from '@vueuse/head';

import App from './App.vue';
import router from './router'; // router는 여기서만 import
import './store/auth'; // auth 스토어 초기화
import { isRecentlyAuthenticated } from './store/auth'; // 상태 변수만 import

import PrimeVue from 'primevue/config';
import ToastService from 'primevue/toastservice';
import ConfirmationService from 'primevue/confirmationservice';
import { definePreset } from '@primeuix/themes';
import Lara from '@primeuix/themes/lara';

import './styles/style.scss';

import {
    Chart as ChartJS,
    Title,
    Tooltip,
    Legend,
    BarElement,
    CategoryScale,
    LinearScale,
    PointElement,
    LineElement,
    BarController,
    LineController,
} from 'chart.js';
import ChartDataLabels from 'chartjs-plugin-datalabels';
import Annotation from 'chartjs-plugin-annotation';

ChartJS.register(
    Title,
    Tooltip,
    Legend,
    BarElement,
    CategoryScale,
    LinearScale,
    PointElement,
    LineElement,
    BarController,
    LineController,
    ChartDataLabels,
    Annotation
);

const MyPreset = definePreset(Lara, {
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

app.use(router); // Vue 앱에 라우터를 먼저 등록합니다.
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

// --- 핵심: router.afterEach 로직을 여기에 추가합니다 ---
// 이 코드는 router가 앱에 등록된 후에 실행되어야 합니다.
router.afterEach(() => {
    // 페이지가 이동할 때마다 마이페이지의 사전 인증 상태를 초기화합니다.
    isRecentlyAuthenticated.value = false;
});

app.mount('#app');
