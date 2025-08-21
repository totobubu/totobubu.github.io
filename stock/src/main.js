// src/main.js

import { createApp } from 'vue';
import App from './App.vue';
import router from './router';
import './store/auth';
import { isRecentlyAuthenticated } from './store/auth';

import PrimeVue from 'primevue/config';
import ToastService from 'primevue/toastservice';
import ConfirmationService from 'primevue/confirmationservice';
import Tooltip from 'primevue/tooltip'; // PrimeVue의 Tooltip (v-tooltip용)

import { definePreset } from '@primeuix/themes';
import Lara from '@primeuix/themes/lara';

import './styles/style.scss';

// --- 핵심 수정: Chart.js의 Tooltip 이름을 'ChartTooltip'으로 변경 ---
import {
    Chart as ChartJS,
    Title,
    Tooltip as ChartTooltip, // Tooltip -> ChartTooltip 으로 별칭 지정
    Legend,
    BarElement,
    CategoryScale,
    LinearScale,
    PointElement,
    LineElement,
    BarController,
    LineController,
} from 'chart.js';
// -----------------------------------------------------------------

import ChartDataLabels from 'chartjs-plugin-datalabels';
import Annotation from 'chartjs-plugin-annotation';

ChartJS.register(
    Title,
    ChartTooltip, // Tooltip -> ChartTooltip 으로 변경
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

app.use(router);
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
app.directive('tooltip', Tooltip);

router.afterEach(() => {
    isRecentlyAuthenticated.value = false;
});

app.mount('#app');
