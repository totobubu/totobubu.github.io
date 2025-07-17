import { createApp } from 'vue';
import App from './App.vue';
import router from './router';

// 1. PrimeVue와 같은 라이브러리들을 먼저 import 합니다.
import PrimeVue from 'primevue/config';
import Aura from "@primeuix/themes/aura";

// 2. 모든 라이브러리 CSS가 로드된 후, 맨 마지막에 우리의 커스텀 SCSS를 import 합니다.
import './styles/dashboard.scss'; 
import './styles/custom.scss';

// Chart.js와 플러그인 import
import { Chart as ChartJS, Title, Tooltip, Legend, BarElement, CategoryScale, LinearScale, PointElement, LineElement, BarController, LineController } from 'chart.js';
import ChartDataLabels from 'chartjs-plugin-datalabels';

// --- DEBUG ---
console.log('%c[main.js] 앱 시작. Chart.js와 Datalabels 플러그인 등록 시도.', 'color: red; font-size: 1.2em; font-weight: bold;');
try {
    ChartJS.register(
        Title, Tooltip, Legend, BarElement, CategoryScale, LinearScale,
        PointElement, LineElement, BarController, LineController,
        ChartDataLabels // 이 플러그인이 핵심
    );
    console.log('%c[main.js] Chart.js 플러그인 등록 성공!', 'color: red; font-weight: bold;', ChartJS.plugins);
} catch (e) {
    console.error('%c[main.js] Chart.js 플러그인 등록 실패!!!', 'color: red; font-size: 1.5em; font-weight: bold;', e);
}
// --- END DEBUG ---


const app = createApp(App);

app.use(router)
app.use(PrimeVue, {
	theme: {
		preset: Aura,
		options: {
			darkModeSelector: ".p-dark",
		}
	},
});

app.mount("#app");
