<script setup lang="ts">
/**
 * 镜头拍摄状态标签：未开机 / 拍摄中 / 已完成。
 * 被 /、/shots/new、/shots/:id 消费。
 */
import { computed } from 'vue';
import type { ShotStatus } from '../../types/shot';

interface Props {
  status: ShotStatus | string;
  size?: 'small' | 'default';
}

const props = withDefaults(defineProps<Props>(), {
  size: 'default',
});

const colorMap: Record<string, { bg: string; fg: string }> = {
  未开机: { bg: '#eef1f6', fg: '#5a6472' },
  拍摄中: { bg: '#fff3dc', fg: '#a8730f' },
  已完成: { bg: '#e4f5ec', fg: '#227a52' },
};

const style = computed(() => colorMap[props.status] ?? { bg: '#eef1f6', fg: '#5a6472' });
</script>

<template>
  <span
    class="status-tag"
    :class="size"
    :style="{ background: style.bg, color: style.fg }"
    :data-status="status"
    data-testid="status-tag"
  >
    {{ status }}
  </span>
</template>

<style scoped>
.status-tag {
  display: inline-flex;
  align-items: center;
  border-radius: 999px;
  padding: 2px 10px;
  font-size: 12px;
  line-height: 20px;
  white-space: nowrap;
}
.status-tag.small {
  padding: 0 8px;
  font-size: 11px;
}
</style>
