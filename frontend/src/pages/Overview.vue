<script setup lang="ts">
/**
 * 进度总览：列出各镜头状态、帧数、预计时长与完成百分比，
 * 累计全片张数与待拍张数。消费 Shot、TakeLog、FrameEntry。
 */
import { computed, onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import { storeToRefs } from 'pinia';
import { useShotStore } from '../stores/shotStore';
import { useFrameStore } from '../stores/frameStore';
import { useProgress } from '../hooks/useProgress';
import { listAllFrames } from '../db/api';
import { framesToDuration } from '../utils/frameMath';
import { formatDateTime } from '../utils/format';
import ShotProgress from '../components/common/ShotProgress.vue';
import StatusTag from '../components/common/StatusTag.vue';
import EmptyState from '../components/common/EmptyState.vue';
import type { FrameEntry } from '../types/frame';

const router = useRouter();
const shotStore = useShotStore();
const frameStore = useFrameStore();
const { shots } = storeToRefs(shotStore);
const { summaries, overall, loadTakes, loading } = useProgress();

const allFrames = ref<FrameEntry[]>([]);

onMounted(async () => {
  await shotStore.load();
  await loadTakes();
  allFrames.value = await listAllFrames();
});

const summaryOf = (shotId: number | undefined) => summaries.value.find((s) => s.shotId === shotId);

const rows = computed(() =>
  shots.value.map((shot) => {
    const frames = allFrames.value.filter((f) => f.shotId === shot.id);
    const summary = summaryOf(shot.id);
    return {
      shot,
      frameCount: frames.length,
      duration: framesToDuration(shot.endFrame - shot.startFrame + 1, shot.fps),
      summary,
    };
  }),
);

const waitingFrames = computed(() => overall.value.remaining);
const statusCount = computed(() => ({
  idle: shots.value.filter((s) => s.status === '未开机').length,
  shooting: shots.value.filter((s) => s.status === '拍摄中').length,
  done: shots.value.filter((s) => s.status === '已完成').length,
}));

function goDetail(id: number | undefined) {
  if (typeof id !== 'number') return;
  void frameStore.loadForShot(id);
  void router.push(`/shots/${id}`);
}
</script>

<template>
  <section class="page">
    <header class="page-head">
      <div>
        <h1>进度总览</h1>
        <p class="sub">定格动画拍摄全片的镜头状态、帧序规模与实拍完成度</p>
      </div>
      <div class="head-actions">
        <button type="button" class="btn primary" @click="router.push('/shots/new')">新建镜头</button>
        <button type="button" class="btn" @click="router.push('/frames')">帧序编排台</button>
      </div>
    </header>

    <div class="stat-row">
      <div class="stat">
        <span class="label">镜头总数</span>
        <span class="value">{{ shots.length }}</span>
        <span class="hint">未开机 {{ statusCount.idle }} · 拍摄中 {{ statusCount.shooting }} · 已完成 {{ statusCount.done }}</span>
      </div>
      <div class="stat">
        <span class="label">全片计划张数</span>
        <span class="value">{{ overall.planned }}</span>
        <span class="hint">已登记帧条目 {{ allFrames.length }} 条</span>
      </div>
      <div class="stat">
        <span class="label">累计实拍张数</span>
        <span class="value">{{ overall.taken }}</span>
        <span class="hint">废帧 {{ overall.wasted }} 张</span>
      </div>
      <div class="stat">
        <span class="label">待拍张数</span>
        <span class="value">{{ waitingFrames }}</span>
        <span class="hint">整体完成 {{ overall.percent }}%</span>
      </div>
    </div>

    <div class="panel">
      <div class="panel-head">
        <h2>镜头清单</h2>
        <span class="muted">{{ loading ? '读取实拍记录中…' : '数据来源：IndexedDB（gbstopmotion-db）' }}</span>
      </div>

      <EmptyState
        v-if="!rows.length"
        title="还没有镜头"
        description="创建第一个镜头后，这里会汇总各镜头的帧数与完成百分比。"
        action-text="新建镜头"
        @action="router.push('/shots/new')"
      />

      <table v-else class="table" data-testid="shot-table">
        <thead>
          <tr>
            <th>镜号</th>
            <th>场景</th>
            <th>状态</th>
            <th>帧率</th>
            <th>帧区间</th>
            <th>帧条目</th>
            <th>预计时长</th>
            <th>完成度</th>
            <th>负责人</th>
            <th>操作</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="row in rows" :key="row.shot.id">
            <td class="mono">{{ row.shot.code }}</td>
            <td>{{ row.shot.sceneName }}</td>
            <td><StatusTag :status="row.shot.status" size="small" /></td>
            <td>{{ row.shot.fps }} fps</td>
            <td class="mono">{{ row.shot.startFrame }} – {{ row.shot.endFrame }}</td>
            <td>{{ row.frameCount }}</td>
            <td>{{ row.duration }} s</td>
            <td class="progress-cell">
              <ShotProgress
                compact
                :planned="row.summary?.planned ?? 0"
                :taken="row.summary?.taken ?? 0"
                :wasted="row.summary?.wasted ?? 0"
                :remaining="row.summary?.remaining ?? 0"
                :percent="row.summary?.percent ?? 0"
              />
            </td>
            <td>{{ row.shot.owner || '未指派' }}</td>
            <td>
              <button type="button" class="btn small" @click="goDetail(row.shot.id)">查看详情</button>
            </td>
          </tr>
        </tbody>
      </table>

      <p v-if="rows.length" class="muted footer-note">
        最近更新：{{ formatDateTime(Math.max(...shots.map((s) => s.updatedAt || 0))) }}
      </p>
    </div>
  </section>
</template>

<style scoped>
.page {
  display: flex;
  flex-direction: column;
  gap: 18px;
}
.page-head {
  display: flex;
  justify-content: space-between;
  align-items: flex-end;
  gap: 16px;
}
h1 {
  margin: 0;
  font-size: 22px;
}
.sub {
  margin: 4px 0 0;
  color: #6b7686;
  font-size: 13px;
}
.head-actions {
  display: flex;
  gap: 10px;
}
.stat-row {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 12px;
}
.stat {
  background: #fff;
  border: 1px solid #e2e7ef;
  border-radius: 10px;
  padding: 14px;
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.stat .label {
  font-size: 12px;
  color: #6b7686;
}
.stat .value {
  font-size: 24px;
  font-weight: 700;
  color: #1f2d3d;
}
.stat .hint {
  font-size: 12px;
  color: #8a94a6;
}
.panel {
  background: #fff;
  border: 1px solid #e2e7ef;
  border-radius: 10px;
  padding: 16px;
}
.panel-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}
.panel-head h2 {
  margin: 0;
  font-size: 16px;
}
.muted {
  color: #8a94a6;
  font-size: 12px;
}
.table {
  width: 100%;
  border-collapse: collapse;
  font-size: 13px;
}
.table th,
.table td {
  text-align: left;
  padding: 10px 8px;
  border-bottom: 1px solid #eef1f6;
  vertical-align: middle;
}
.table th {
  color: #6b7686;
  font-weight: 600;
  font-size: 12px;
}
.mono {
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
}
.progress-cell {
  min-width: 210px;
}
.btn {
  height: 32px;
  padding: 0 14px;
  border-radius: 6px;
  border: 1px solid #cfd6e0;
  background: #fff;
  color: #1f2d3d;
  cursor: pointer;
  font-size: 13px;
}
.btn.primary {
  background: #2f6fed;
  border-color: #2f6fed;
  color: #fff;
}
.btn.small {
  height: 28px;
  padding: 0 10px;
  font-size: 12px;
}
.footer-note {
  margin: 10px 0 0;
}
</style>
