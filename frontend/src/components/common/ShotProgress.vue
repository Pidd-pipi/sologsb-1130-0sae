<script setup lang="ts">
/**
 * 镜头进度条与张数统计组件。
 * 被 /、/shots/:id、/progress 消费。
 */
import { computed } from 'vue';
import { formatPercent } from '../../utils/format';

interface Props {
  code?: string;
  planned: number;
  taken: number;
  wasted?: number;
  remaining?: number;
  percent?: number;
  compact?: boolean;
  status?: string;
}

const props = withDefaults(defineProps<Props>(), {
  code: '',
  wasted: 0,
  remaining: undefined,
  percent: undefined,
  compact: false,
  status: '',
});

const percentValue = computed(() => {
  if (typeof props.percent === 'number') return Math.min(100, Math.max(0, Math.round(props.percent)));
  if (!props.planned) return 0;
  return Math.min(100, Math.round((props.taken / props.planned) * 100));
});

const remainingValue = computed(() =>
  typeof props.remaining === 'number' ? props.remaining : Math.max(0, props.planned - props.taken),
);

const barColor = computed(() => {
  const p = percentValue.value;
  if (p >= 100) return '#3aa675';
  if (p >= 60) return '#2f6fed';
  if (p > 0) return '#d99b2b';
  return '#b9c2d0';
});
</script>

<template>
  <div class="shot-progress" :class="{ compact }" data-testid="shot-progress">
    <div class="head">
      <span class="code" v-if="code">{{ code }}</span>
      <span class="percent">{{ formatPercent(percentValue) }}</span>
      <span class="status" v-if="status">{{ status }}</span>
    </div>
    <div class="bar">
      <div class="bar-inner" :style="{ width: percentValue + '%', background: barColor }"></div>
    </div>
    <div class="stats">
      <span>计划 {{ planned }} 张</span>
      <span>已拍 {{ taken }} 张</span>
      <span v-if="wasted">废帧 {{ wasted }} 张</span>
      <span>剩余 {{ remainingValue }} 张</span>
    </div>
  </div>
</template>

<style scoped>
.shot-progress {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.head {
  display: flex;
  align-items: baseline;
  gap: 10px;
}
.code {
  font-weight: 700;
  font-size: 14px;
}
.percent {
  margin-left: auto;
  font-size: 13px;
  color: #2f6fed;
  font-weight: 600;
}
.status {
  font-size: 12px;
  color: #6b7686;
}
.bar {
  height: 10px;
  border-radius: 6px;
  background: #edf0f5;
  overflow: hidden;
}
.bar-inner {
  height: 100%;
  border-radius: 6px;
  transition: width 0.25s ease;
}
.stats {
  display: flex;
  flex-wrap: wrap;
  gap: 14px;
  font-size: 12px;
  color: #5a6472;
}
.compact .stats {
  gap: 10px;
}
</style>
