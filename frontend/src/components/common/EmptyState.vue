<script setup lang="ts">
/**
 * 空状态提示：列表或条带没有数据时展示引导文案与可选操作。
 */
interface Props {
  title?: string;
  description?: string;
  actionText?: string;
}

const props = withDefaults(defineProps<Props>(), {
  title: '暂无数据',
  description: '先创建一条记录，再回到这里查看。',
  actionText: '',
});

const emit = defineEmits<{ (e: 'action'): void }>();
</script>

<template>
  <div class="empty-state" data-testid="empty-state">
    <div class="glyph">◍</div>
    <div class="title">{{ props.title }}</div>
    <div class="desc">{{ props.description }}</div>
    <button v-if="props.actionText" type="button" class="btn" @click="emit('action')">{{ props.actionText }}</button>
  </div>
</template>

<style scoped>
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  padding: 36px 16px;
  color: #6b7686;
  background: #fbfcfe;
  border: 1px dashed #d8dee9;
  border-radius: 10px;
}
.glyph {
  font-size: 26px;
  color: #b9c2d0;
}
.title {
  font-weight: 600;
  color: #3d4757;
}
.desc {
  font-size: 12px;
}
.btn {
  margin-top: 8px;
  height: 30px;
  padding: 0 14px;
  border-radius: 6px;
  border: 1px solid #2f6fed;
  color: #2f6fed;
  background: #fff;
  cursor: pointer;
  font-size: 13px;
}
</style>
