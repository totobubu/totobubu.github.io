import { createApp } from 'vue'
import App from './App.vue'
import PrimeVue from 'primevue/config'
import router from './router'
import Aura from "@primeuix/themes/aura";

import "./styles/dashboard.scss";
import "./styles/custom.scss";

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
