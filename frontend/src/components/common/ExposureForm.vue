<script setup lang="ts">
/**
 * 曝光参数表单：拍摄张数、曝光时间、光圈、ISO、快门角度、灯光配置、道具位移。
 * 被 /shots/new 与 /frames 消费；v-model 绑定 FrameEntry 的核心字段。
 */
import { computed, reactive, watch } from 'vue';
import type { FrameEntry } from '../../types/frame';
import { SHOT_COUNT_OPTIONS } from '../../types/frame';
import {
  APERTURE_OPTIONS,
  EXPOSURE_OPTIONS,
  ISO_OPTIONS,
  SHUTTER_ANGLE_OPTIONS,
  checkExposure,
  exposureValue,
  suggestExposure,
} from '../../utils/exposure';

interface Props {
  modelValue: Partial<FrameEntry>;
  fps?: number;
  lightingOptions?: string[];
  disabled?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  fps: 24,
  lightingOptions: () => ['主灯 + 柔光箱', '双侧补光', '顶光 + 反光板', '单灯侧逆光'],
  disabled: false,
});

const emit = defineEmits<{
  (e: 'update:modelValue', value: Partial<FrameEntry>): void;
}>();

const local = reactive<Partial<FrameEntry>>({
  shotCount: 2,
  exposureSec: 0.25,
  aperture: 5.6,
  iso: 200,
  shutterAngle: 180,
  lighting: '主灯 + 柔光箱',
  propOffsetMm: 0,
  note: '',
});

let syncing = false;

watch(
  () => props.modelValue,
  (value) => {
    syncing = true;
    Object.assign(local, value);
    queueMicrotask(() => {
      syncing = false;
    });
  },
  { immediate: true, deep: true },
);

watch(
  local,
  () => {
    if (syncing) return;
    emit('update:modelValue', { ...local });
  },
  { deep: true },
);

const warnings = computed(() => checkExposure(local as FrameEntry, props.fps));
const ev = computed(() => exposureValue(local.exposureSec ?? 0, local.aperture ?? 0, local.iso ?? 0));
const suggestion = computed(() => suggestExposure(props.fps));

function applySuggestion() {
  local.exposureSec = suggestion.value;
}

const shotCountOptions = SHOT_COUNT_OPTIONS;
const exposureOptions = EXPOSURE_OPTIONS;
const apertureOptions = APERTURE_OPTIONS;
const isoOptions = ISO_OPTIONS;
const shutterOptions = SHUTTER_ANGLE_OPTIONS;
</script>

<template>
  <div class="exposure-form" data-testid="exposure-form">
    <div class="grid">
      <label class="field">
        <span>拍摄张数</span>
        <select v-model.number="local.shotCount" :disabled="disabled" data-testid="exposure-shotcount">
          <option v-for="opt in shotCountOptions" :key="opt" :value="opt">{{ opt }} 张</option>
        </select>
      </label>
      <label class="field">
        <span>曝光时间（秒）</span>
        <select v-model.number="local.exposureSec" :disabled="disabled" data-testid="exposure-time">
          <option v-for="opt in exposureOptions" :key="opt" :value="opt">{{ opt }} s</option>
        </select>
      </label>
      <label class="field">
        <span>光圈 f 值</span>
        <select v-model.number="local.aperture" :disabled="disabled" data-testid="exposure-aperture">
          <option v-for="opt in apertureOptions" :key="opt" :value="opt">f/{{ opt }}</option>
        </select>
      </label>
      <label class="field">
        <span>ISO</span>
        <select v-model.number="local.iso" :disabled="disabled" data-testid="exposure-iso">
          <option v-for="opt in isoOptions" :key="opt" :value="opt">ISO {{ opt }}</option>
        </select>
      </label>
      <label class="field">
        <span>快门角度（度）</span>
        <select v-model.number="local.shutterAngle" :disabled="disabled" data-testid="exposure-shutter">
          <option v-for="opt in shutterOptions" :key="opt" :value="opt">{{ opt }}°</option>
        </select>
      </label>
      <label class="field">
        <span>灯光配置</span>
        <select v-model="local.lighting" :disabled="disabled" data-testid="exposure-lighting">
          <option v-for="opt in lightingOptions" :key="opt" :value="opt">{{ opt }}</option>
        </select>
      </label>
      <label class="field">
        <span>道具位移量（mm）</span>
        <input
          v-model.number="local.propOffsetMm"
          type="number"
          min="-200"
          max="200"
          step="0.5"
          :disabled="disabled"
          data-testid="exposure-offset"
        />
      </label>
      <label class="field wide">
        <span>备注</span>
        <input v-model="local.note" type="text" maxlength="80" :disabled="disabled" data-testid="exposure-note" />
      </label>
    </div>

    <div class="readout">
      <span>等效曝光值 EV：{{ ev }}</span>
      <span>建议曝光时间（180° 快门）：{{ suggestion }} s</span>
      <button type="button" class="link-btn" :disabled="disabled" @click="applySuggestion">套用建议值</button>
    </div>

    <ul v-if="warnings.length" class="warn-list" data-testid="exposure-warnings">
      <li v-for="w in warnings" :key="w.field + w.message">{{ w.message }}</li>
    </ul>
  </div>
</template>

<style scoped>
.exposure-form {
  border: 1px solid #d8dee9;
  border-radius: 10px;
  padding: 12px;
  background: #fff;
}
.grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(170px, 1fr));
  gap: 10px;
}
.field {
  display: flex;
  flex-direction: column;
  gap: 4px;
  font-size: 12px;
  color: #5a6472;
}
.field.wide {
  grid-column: span 2;
}
.field select,
.field input {
  height: 32px;
  border: 1px solid #cfd6e0;
  border-radius: 6px;
  padding: 0 8px;
  font-size: 13px;
  background: #fff;
  color: #1f2d3d;
}
.readout {
  display: flex;
  flex-wrap: wrap;
  gap: 16px;
  align-items: center;
  margin-top: 10px;
  font-size: 12px;
  color: #5a6472;
}
.link-btn {
  border: none;
  background: none;
  color: #2f6fed;
  cursor: pointer;
  font-size: 12px;
  padding: 0;
}
.link-btn:disabled {
  color: #a5b0c0;
  cursor: not-allowed;
}
.warn-list {
  margin: 8px 0 0;
  padding-left: 18px;
  color: #c45656;
  font-size: 12px;
}
</style>
