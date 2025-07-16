import { createApp } from 'vue';
import App from './App.vue';
import router from './router';

// 1. PrimeVue와 같은 라이브러리들을 먼저 import 합니다.
import PrimeVue from 'primevue/config';
import Aura from "@primeuix/themes/aura";

// 2. 모든 라이브러리 CSS가 로드된 후, 맨 마지막에 우리의 커스텀 SCSS를 import 합니다.
import './styles/dashboard.scss'; 
import './styles/custom.scss'; 

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
