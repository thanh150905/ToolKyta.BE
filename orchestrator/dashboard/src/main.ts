import { createApp } from 'vue';
import '@vue-flow/core/dist/style.css';
import '@vue-flow/core/dist/theme-default.css';
import '@vue-flow/controls/dist/style.css';
import './style.css';
import App from './App.vue';
import { init } from './store';

init();
createApp(App).mount('#app');
