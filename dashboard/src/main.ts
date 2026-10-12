import { createApp } from 'vue';
import App from './App.vue';
import { loadModel } from './data';
import './style.css';

loadModel()
  .then(model => createApp(App, { model }).mount('#app'))
  .catch((error: Error) => {
    document.getElementById('app')!.innerHTML =
      `<main class="empty"><h1>No coverage data</h1><p>${error.message}</p>` +
      `<p>Run <code>npm test</code> to produce <code>coverage-report/coverage.json</code>.</p></main>`;
  });
