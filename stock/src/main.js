// stock/src/main.js
import { createApp } from 'vue';
import App from './App.vue';
import router from './router';

import PrimeVue from 'primevue/config';
import Lara from "@primeuix/themes/lara";

import './styles/styles.scss';

import { Chart as ChartJS, Title, Tooltip, Legend, BarElement, CategoryScale, LinearScale, PointElement, LineElement, BarController, LineController } from 'chart.js';
import ChartDataLabels from 'chartjs-plugin-datalabels';

ChartJS.register(
    Title, Tooltip, Legend, BarElement, CategoryScale, LinearScale,
    PointElement, LineElement, BarController, LineController,
    ChartDataLabels
);

const app = createApp(App);

app.use(router);
app.use(PrimeVue, {
    theme: {
        preset: Lara,
        options: {
            darkModeSelector: ".p-dark",
        }
    },
});

app.mount("#app");