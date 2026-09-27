<script setup lang="ts">
/**
 * 新建镜头：填写镜号、场景名、帧率与时长，
 * 保存后生成帧区间与首位帧条目（并在总览页可见）。
 */
import { computed, onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import { useShotStore } from '../stores/shotStore';
import { useFrameStore } from '../stores/frameStore';
import { useLocalDraft } from '../hooks/useLocalDraft';
import { buildFrameRange, framesToDuration } from '../utils/frameMath';
import { addFrames } from '../db/api';
import { FPS_OPTIONS, SHOT_STATUS_OPTIONS, type ShotStatus } from '../types/shot';
import { createEmptyFrame, type FrameEntry } from '../types/frame';
import ExposureForm from '../components/common/ExposureForm.vue';
import StatusTag from '../components/common/StatusTag.vue';
import EmptyState from '../components/common/EmptyState.vue';

const router = useRouter();
const shotStore = useShotStore();
const frameStore = useFrameStore();

const { draft, savedAt, reset } = useLocalDraft('shot-new', {
  code: 'S01',
  sceneName: '书房夜景',
  fps: 24,
  durationSec: 2,
  startFrame: 1,
  status: '未开机' as ShotStatus,
  owner: '',
});

const exposure = ref<Partial<FrameEntry>>({
  shotCount: 2,
  exposureSec: 0.25,
  aperture: 5.6,
  iso: 200,
  shutterAngle: 180,
  lighting: '主灯 + 柔光箱',
  propOffsetMm: 0,
  note: '',
});

const submitting = ref(false);
const errorText = ref('');
const duplicateCode = ref(false);

const range = computed(() => buildFrameRange(draft.value.startFrame, draft.value.durationSec, draft.value.fps));
const plannedDuration = computed(() => framesToDuration(range.value.frameCount, draft.value.fps));
const fpsOptions = FPS_OPTIONS;
const statusOptions = SHOT_STATUS_OPTIONS;

const suggestedCode = computed(() => {
  const nums = shotStore.shots
    .map((s) => Number((s.code.match(/\d+/) ?? [])[0]))
    .filter((n) => Number.isFinite(n));
  const next = nums.length ? Math.max(...nums) + 1 : 1;
  return `S${String(next).padStart(2, '0')}`;
});

onMounted(async () => {
  if (!shotStore.ready) await shotStore.load();
});

function checkDuplicate() {
  duplicateCode.value = shotStore.shots.some((s) => s.code.trim() === draft.value.code.trim());
  return duplicateCode.value;
}

function validate(): string {
  if (!draft.value.code.trim()) return '请填写镜号';
  if (!/^[A-Za-z]{1,3}\d{1,3}$/.test(draft.value.code.trim())) return '镜号格式形如 S01';
  if (!draft.value.sceneName.trim()) return '请填写场景名';
  if (draft.value.fps <= 0) return '帧率需大于 0';
  if (draft.value.durationSec <= 0) return '时长需大于 0 秒';
  if (draft.value.startFrame < 1) return '起始帧号需不小于 1';
  if (checkDuplicate()) return '该镜号已存在，请换一个';
  return '';
}

async function submit() {
  errorText.value = validate();
  if (errorText.value) return;
  submitting.value = true;
  try {
    const shot = await shotStore.create({
      code: draft.value.code.trim().toUpperCase(),
      sceneName: draft.value.sceneName.trim(),
      fps: draft.value.fps,
      durationSec: draft.value.durationSec,
      startFrame: draft.value.startFrame,
      status: draft.value.status,
      owner: draft.value.owner.trim(),
    });
    const first: FrameEntry = { ...createEmptyFrame(shot.id as number, shot.startFrame), ...exposure.value, id: undefined };
    await addFrames([first]);
    await frameStore.loadForShot(shot.id as number);
    reset();
    await router.push(`/shots/${shot.id}`);
  } catch (e) {
    errorText.value = e instanceof Error ? e.message : '保存失败，请重试';
  } finally {
    submitting.value = false;
  }
}

function useSuggested() {
  draft.value.code = suggestedCode.value;
  duplicateCode.value = false;
}
</script>

<template>
  <section class="page">
    <header class="page-head">
      <div>
        <h1>新建镜头</h1>
        <p class="sub">按帧率与时长自动排出帧区间，并生成首位帧条目</p>
      </div>
      <StatusTag :status="draft.status" />
    </header>

    <form class="panel" @submit.prevent="submit">
      <div class="grid">
        <label class="field">
          <span>镜号</span>
          <input id="shot-code" v-model="draft.code" type="text" maxlength="8" data-testid="shot-code" @change="checkDuplicate" />
          <small v-if="duplicateCode" class="err">该镜号已存在</small>
        </label>
        <label class="field">
          <span>场景名</span>
          <input id="shot-scene" v-model="draft.sceneName" type="text" maxlength="40" data-testid="shot-scene" />
        </label>
        <label class="field">
          <span>帧率（fps）</span>
          <select id="shot-fps" v-model.number="draft.fps" data-testid="shot-fps">
            <option v-for="opt in fpsOptions" :key="opt" :value="opt">{{ opt }} fps</option>
          </select>
        </label>
        <label class="field">
          <span>预计时长（秒）</span>
          <input
            id="shot-duration"
            v-model.number="draft.durationSec"
            type="number"
            min="0.5"
            max="60"
            step="0.5"
            data-testid="shot-duration"
          />
        </label>
        <label class="field">
          <span>起始帧号</span>
          <input
            id="shot-start"
            v-model.number="draft.startFrame"
            type="number"
            min="1"
            max="9999"
            step="1"
            data-testid="shot-start"
          />
        </label>
        <label class="field">
          <span>拍摄状态</span>
          <select id="shot-status" v-model="draft.status" data-testid="shot-status">
            <option v-for="opt in statusOptions" :key="opt" :value="opt">{{ opt }}</option>
          </select>
        </label>
        <label class="field">
          <span>负责人</span>
          <input id="shot-owner" v-model="draft.owner" type="text" maxlength="20" data-testid="shot-owner" />
        </label>
      </div>

      <div class="range-preview" data-testid="range-preview">
        <span>帧区间预览：</span>
        <strong>{{ range.startFrame }} – {{ range.endFrame }}</strong>
        <span>共 {{ range.frameCount }} 帧 · 时长 {{ plannedDuration }} s</span>
        <button type="button" class="link-btn" @click="useSuggested">使用建议镜号 {{ suggestedCode }}</button>
      </div>

      <div class="section-title">首位帧条目曝光参数</div>
      <ExposureForm v-model="exposure" :fps="draft.fps" />

      <p v-if="errorText" class="err big" data-testid="form-error">{{ errorText }}</p>
      <p v-if="savedAt" class="muted">草稿已暂存到 localStorage（gbstopmotion:draft:shot-new）</p>

      <div class="actions">
        <button type="submit" class="btn primary" :disabled="submitting" data-testid="submit-shot">
          {{ submitting ? '保存中…' : '保存并生成帧序' }}
        </button>
        <button type="button" class="btn" @click="reset">清空草稿</button>
        <button type="button" class="btn" @click="router.push('/')">返回总览</button>
      </div>
    </form>

    <EmptyState
      v-if="!shotStore.shots.length"
      title="目前还没有其它镜头"
      description="保存后可在进度总览查看该镜头的计划张数与完成情况。"
    />
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
.panel {
  background: #fff;
  border: 1px solid #e2e7ef;
  border-radius: 10px;
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 14px;
}
.grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: 12px;
}
.field {
  display: flex;
  flex-direction: column;
  gap: 4px;
  font-size: 12px;
  color: #5a6472;
}
.field input,
.field select {
  height: 32px;
  border: 1px solid #cfd6e0;
  border-radius: 6px;
  padding: 0 8px;
  font-size: 13px;
  background: #fff;
  color: #1f2d3d;
}
.range-preview {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  align-items: center;
  font-size: 13px;
  color: #3d4757;
  background: #f5f8ff;
  border: 1px solid #dbe6ff;
  border-radius: 8px;
  padding: 10px 12px;
}
.link-btn {
  margin-left: auto;
  border: none;
  background: none;
  color: #2f6fed;
  cursor: pointer;
  font-size: 12px;
}
.section-title {
  font-weight: 600;
  font-size: 14px;
  color: #1f2d3d;
}
.actions {
  display: flex;
  gap: 10px;
}
.btn {
  height: 34px;
  padding: 0 16px;
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
.btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}
.err {
  color: #c45656;
  font-size: 12px;
}
.err.big {
  font-size: 13px;
}
.muted {
  color: #8a94a6;
  font-size: 12px;
  margin: 0;
}
</style>
