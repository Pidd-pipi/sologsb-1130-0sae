import { createApp } from 'vue';
import { createPinia } from 'pinia';
import ElementPlus from 'element-plus';
import 'element-plus/dist/index.css';
import App from './App.vue';
import router from './router';
import { initDb } from './db/api';
import './style.css';

async function bootstrap() {
  // 打开 IndexedDB（含 v1→v2→v3 升级迁移），失败不阻塞首屏渲染
  try {
    await initDb();
  } catch (e) {
    console.error('[gbstopmotion] IndexedDB 初始化失败', e);
  }

  const app = createApp(App);
  app.use(createPinia());
  app.use(router);
  app.use(ElementPlus);
  app.mount('#app');
}

void bootstrap();
