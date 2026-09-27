/** 路由表：6 个核心页面，均对应提示词中的路径 */
import { createRouter, createWebHistory, type RouteRecordRaw } from 'vue-router';
import Overview from '../pages/Overview.vue';
import ShotNew from '../pages/ShotNew.vue';
import ShotDetail from '../pages/ShotDetail.vue';
import FrameBoard from '../pages/FrameBoard.vue';
import PropTrack from '../pages/PropTrack.vue';
import TakeLog from '../pages/TakeLog.vue';

const routes: RouteRecordRaw[] = [
  { path: '/', name: 'overview', component: Overview, meta: { title: '进度总览' } },
  { path: '/shots/new', name: 'shot-new', component: ShotNew, meta: { title: '新建镜头' } },
  { path: '/shots/:id', name: 'shot-detail', component: ShotDetail, props: true, meta: { title: '镜头详情' } },
  { path: '/frames', name: 'frames', component: FrameBoard, meta: { title: '帧序编排台' } },
  { path: '/props', name: 'props', component: PropTrack, meta: { title: '道具位移轨迹' } },
  { path: '/progress', name: 'progress', component: TakeLog, meta: { title: '实拍记录' } },
  { path: '/:pathMatch(.*)*', redirect: '/' },
];

export const navItems: { path: string; label: string }[] = [
  { path: '/', label: '进度总览' },
  { path: '/shots/new', label: '新建镜头' },
  { path: '/frames', label: '帧序编排台' },
  { path: '/props', label: '道具位移轨迹' },
  { path: '/progress', label: '实拍记录' },
];

const router = createRouter({
  history: createWebHistory(),
  routes,
  scrollBehavior: () => ({ top: 0 }),
});

router.afterEach((to) => {
  const title = (to.meta.title as string | undefined) ?? '定格动画拍摄帧序编排台';
  document.title = `${title} · 定格动画拍摄帧序编排台`;
});

export default router;
