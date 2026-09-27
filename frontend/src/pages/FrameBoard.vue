<script setup lang="ts">
/**
 * 帧序编排台：在条带上移动帧、插入或删除帧、批量套用曝光，
 * 改动后重算帧序号与总时长。消费 FrameEntry、Shot。
 */
import { computed, onMounted, ref, watch } from 'vue';
import { storeToRefs } from 'pinia';
import { useShotStore } from '../stores/shotStore';
import { useFrameStore } from '../stores/frameStore';
import { useFrameSequence } from '../hooks/useFrameSequence';
import { useLocalDraft } from '../hooks/useLocalDraft';
import { durationToFrames, framesToDuration } from '../utils/frameMath';
import { APERTURE_OPTIONS, EXPOSURE_OPTIONS, ISO_OPTIONS, SHUTTER_ANGLE_OPTIONS } from '../utils/exposure';
import type { BatchExposure, FrameEntry } from '../types/frame';
import type { Shot } from '../types/shot';
import FrameStrip from '../components/common/FrameStrip.vue';
import ExposureForm from '../components/common/ExposureForm.vue';
import EmptyState from '../components/common/EmptyState.vue';
import StatusTag from '../components/common/StatusTag.vue';

const shotStore = useShotStore();
const frameStore = useFrameStore();
const { shots } = storeToRefs(shotStore);
const { frames, selectedFrameNo } = storeToRefs(frameStore);
const { insertAfter, removeAt, move, patch, select, syncShotRange, totalDuration, fps } = useFrameSequence();

const activeShotId = ref<number | null>(null);
const feedback = ref('');
const newFrame = ref<Partial<FrameEntry>>({
  shotCount: 2,
  exposureSec: 0.25,
  aperture: 5.6,
  iso: 200,
  shutterAngle: 180,
  lighting: '主灯 + 柔光箱',
  propOffsetMm: 0,
  note: '',
});

const { draft: batch, reset: resetBatch } = useLocalDraft<BatchExposure>('frame-batch-exposure', {
  exposureSec: 0.125,
  aperture: 4,
  iso: 400,
  shutterAngle: 180,
});

const activeShot = computed<Shot | undefined>(() => (activeShotId.value === null ? undefined : shotStore.byId(activeShotId.value)));
const planned = computed(() => (activeShot.value ? durationToFrames(activeShot.value.durationSec, activeShot.value.fps) : 0));
const ordered = computed(() => frames.value.slice().sort((a, b) => a.frameNo - b.frameNo));
const exposureOptions = EXPOSURE_OPTIONS;
const apertureOptions = APERTURE_OPTIONS;
const isoOptions = ISO_OPTIONS;
const shutterOptions = SHUTTER_ANGLE_OPTIONS;

onMounted(async () => {
  if (!shotStore.ready) await shotStore.load();
  const first = shots.value[0];
  if (first && typeof first.id === 'number') {
    activeShotId.value = first.id;
    await frameStore.loadForShot(first.id);
  }
});

watch(activeShotId, async (id) => {
  if (typeof id === 'number') await frameStore.loadForShot(id);
});

function flash(text: string) {
  feedback.value = text;
  window.setTimeout(() => {
    if (feedback.value === text) feedback.value = '';
  }, 3200);
}

async function doInsert() {
  if (activeShotId.value === null) return;
  await insertAfter(selectedFrameNo.value);
  const created = frames.value.find((f) => f.frameNo === (selectedFrameNo.value ?? 0) + 1) ?? frames.value[frames.value.length - 1];
  if (created) {
    await patch(created.frameNo, newFrame.value);
    select(created.frameNo);
  }
  flash('已插入一帧并重排序号');
}

async function doRemove() {
  if (selectedFrameNo.value === null) {
    flash('请先点选要删除的帧');
    return;
  }
  await removeAt(selectedFrameNo.value);
  flash('已删除该帧并重排序号');
}

async function doReorder(from: number, to: number) {
  await move(from, to);
  flash(`已把第 ${from + 1} 个色块移动到第 ${to + 1} 位`);
}

async function doBatch() {
  if (activeShotId.value === null) return;
  await frameStore.applyBatch({ ...batch.value });
  flash('已对全部帧批量套用曝光参数');
}

async function doBatchSelectedOnly() {
  if (selectedFrameNo.value === null) {
    flash('请先点选一帧，再做单帧批量套用');
    return;
  }
  const index = ordered.value.findIndex((f) => f.frameNo === selectedFrameNo.value);
  await frameStore.applyBatch({ ...batch.value }, [index]);
  flash('已对选中帧套用曝光参数');
}

async function patchFrame(frameNo: number, value: Partial<FrameEntry>) {
  await patch(frameNo, value);
}

function shiftFrame(frame: FrameEntry, dir: -1 | 1) {
  const index = ordered.value.findIndex((f) => f.frameNo === frame.frameNo);
  const target = index + dir;
  if (target < 0 || target >= ordered.value.length) return;
  void move(index, target);
}
</script>

<template>
  <section class="page">
    <header class="page-head">
      <div>
        <h1>帧序编排台</h1>
        <p class="sub">在条带上移动、插入、删除帧，并批量套用曝光参数；改动后帧序号与镜头时长即时重算</p>
      </div>
      <div class="head-actions">
        <select v-model.number="activeShotId" data-testid="board-shot-select" class="shot-select">
          <option :value="null" disabled>选择镜头</option>
          <option v-for="s in shots" :key="s.id" :value="s.id">{{ s.code }} · {{ s.sceneName }}</option>
        </select>
        <StatusTag v-if="activeShot" :status="activeShot.status" />
      </div>
    </header>

    <EmptyState
      v-if="!shots.length"
      title="还没有可编排的镜头"
      description="先到「新建镜头」创建一条镜头，再回到编排台调整帧序。"
    />

    <template v-else-if="activeShot">
      <p v-if="feedback" class="feedback" data-testid="board-feedback">{{ feedback }}</p>

      <div class="stat-row">
        <div class="stat"><span class="label">镜号</span><span class="value small mono">{{ activeShot.code }}</span></div>
        <div class="stat"><span class="label">条带帧数</span><span class="value">{{ frames.length }}</span></div>
        <div class="stat"><span class="label">计划张数</span><span class="value">{{ planned }}</span></div>
        <div class="stat"><span class="label">当前时长</span><span class="value small">{{ totalDuration }} s</span></div>
        <div class="stat"><span class="label">帧率</span><span class="value small">{{ fps }} fps</span></div>
      </div>

      <div class="panel">
        <div class="panel-head">
          <h2>帧序条带</h2>
          <div class="head-actions">
            <button type="button" class="btn small" data-testid="board-insert" @click="doInsert">插入帧</button>
            <button type="button" class="btn small danger" data-testid="board-remove" @click="doRemove">删除选中帧</button>
            <button type="button" class="btn small" @click="syncShotRange">重算时长</button>
          </div>
        </div>
        <FrameStrip :frames="ordered" :selected="selectedFrameNo" @update:selected="select" @reorder="doReorder" @patch="patchFrame" />
      </div>

      <div class="two-panel">
        <div class="panel">
          <div class="panel-head"><h2>批量套用曝光</h2><span class="muted">草稿保存在 localStorage</span></div>
          <div class="batch-grid">
            <label class="field">
              <span>曝光时间（秒）</span>
              <select v-model.number="batch.exposureSec" data-testid="batch-exposure">
                <option v-for="o in exposureOptions" :key="o" :value="o">{{ o }} s</option>
              </select>
            </label>
            <label class="field">
              <span>光圈 f 值</span>
              <select v-model.number="batch.aperture" data-testid="batch-aperture">
                <option v-for="o in apertureOptions" :key="o" :value="o">f/{{ o }}</option>
              </select>
            </label>
            <label class="field">
              <span>ISO</span>
              <select v-model.number="batch.iso" data-testid="batch-iso">
                <option v-for="o in isoOptions" :key="o" :value="o">ISO {{ o }}</option>
              </select>
            </label>
            <label class="field">
              <span>快门角度（度）</span>
              <select v-model.number="batch.shutterAngle" data-testid="batch-shutter">
                <option v-for="o in shutterOptions" :key="o" :value="o">{{ o }}°</option>
              </select>
            </label>
          </div>
          <div class="actions">
            <button type="button" class="btn primary" data-testid="batch-apply" @click="doBatch">套用到全部帧</button>
            <button type="button" class="btn" @click="doBatchSelectedOnly">仅套用到选中帧</button>
            <button type="button" class="btn" @click="resetBatch">复位参数</button>
          </div>
        </div>

        <div class="panel">
          <div class="panel-head"><h2>新帧曝光参数</h2><span class="muted">插入时写入</span></div>
          <ExposureForm v-model="newFrame" :fps="fps" />
        </div>
      </div>

      <div class="panel">
        <div class="panel-head"><h2>帧序明细</h2><span class="muted">可上下移动单帧，序号自动重排</span></div>
        <table class="table" data-testid="board-table">
          <thead>
            <tr><th>位次</th><th>帧号</th><th>张数</th><th>曝光 s</th><th>光圈</th><th>ISO</th><th>位移 mm</th><th>操作</th></tr>
          </thead>
          <tbody>
            <tr v-for="(frame, index) in ordered" :key="frame.id ?? index" :class="{ active: frame.frameNo === selectedFrameNo }" @click="select(frame.frameNo)">
              <td>{{ index + 1 }}</td>
              <td class="mono">{{ frame.frameNo }}</td>
              <td>{{ frame.shotCount }} 张</td>
              <td>{{ frame.exposureSec }}</td>
              <td>f/{{ frame.aperture }}</td>
              <td>{{ frame.iso }}</td>
              <td>{{ frame.propOffsetMm }}</td>
              <td class="row-actions">
                <button type="button" class="btn tiny" :disabled="index === 0" @click.stop="shiftFrame(frame, -1)">上移</button>
                <button type="button" class="btn tiny" :disabled="index === ordered.length - 1" @click.stop="shiftFrame(frame, 1)">下移</button>
              </td>
            </tr>
          </tbody>
        </table>
        <p class="muted">按帧率 {{ fps }} fps 计算，当前帧序等效时长 {{ framesToDuration(ordered.length, fps) }} s。</p>
      </div>
    </template>
  </section>
</template>

<style scoped>
.page {
  display: flex;
  flex-direction: column;
  gap: 16px;
}
.page-head {
  display: flex;
  justify-content: space-between;
  align-items: flex-end;
  gap: 12px;
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
  gap: 8px;
  align-items: center;
}
.shot-select {
  height: 32px;
  border: 1px solid #cfd6e0;
  border-radius: 6px;
  padding: 0 8px;
  font-size: 13px;
  background: #fff;
}
.stat-row {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
  gap: 12px;
}
.stat {
  background: #fff;
  border: 1px solid #e2e7ef;
  border-radius: 10px;
  padding: 12px 14px;
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.stat .label {
  font-size: 12px;
  color: #6b7686;
}
.stat .value {
  font-size: 22px;
  font-weight: 700;
  color: #1f2d3d;
}
.stat .value.small {
  font-size: 15px;
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
.two-panel {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
}
@media (max-width: 1100px) {
  .two-panel {
    grid-template-columns: 1fr;
  }
}
.batch-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
  gap: 10px;
}
.field {
  display: flex;
  flex-direction: column;
  gap: 4px;
  font-size: 12px;
  color: #5a6472;
}
.field select {
  height: 32px;
  border: 1px solid #cfd6e0;
  border-radius: 6px;
  padding: 0 8px;
  font-size: 13px;
  background: #fff;
}
.actions {
  display: flex;
  gap: 10px;
  margin-top: 12px;
}
.table {
  width: 100%;
  border-collapse: collapse;
  font-size: 13px;
}
.table th,
.table td {
  text-align: left;
  padding: 8px 6px;
  border-bottom: 1px solid #eef1f6;
}
.table th {
  color: #6b7686;
  font-weight: 600;
  font-size: 12px;
}
.table tbody tr.active {
  background: #f5f8ff;
}
.mono {
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
}
.muted {
  color: #8a94a6;
  font-size: 12px;
}
.row-actions {
  display: flex;
  gap: 6px;
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
.btn.tiny {
  height: 24px;
  padding: 0 8px;
  font-size: 12px;
}
.btn.danger {
  color: #c45656;
  border-color: #f0c8c8;
}
.btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
.feedback {
  margin: 0;
  background: #eef6ff;
  border: 1px solid #d3e4ff;
  color: #24559c;
  border-radius: 8px;
  padding: 8px 12px;
  font-size: 13px;
}
</style>
