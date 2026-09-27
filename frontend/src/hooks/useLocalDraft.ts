/**
 * 草稿：表单内容暂存到 localStorage，刷新后可恢复。
 * 命名空间统一前缀 gbstopmotion:draft:。
 */
import { ref, watch, type Ref } from 'vue';

const PREFIX = 'gbstopmotion:draft:';

export function draftKey(name: string): string {
  return `${PREFIX}${name}`;
}

export function readDraft<T>(name: string): T | null {
  try {
    const raw = localStorage.getItem(draftKey(name));
    if (!raw) return null;
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export function writeDraft<T>(name: string, value: T): void {
  try {
    localStorage.setItem(draftKey(name), JSON.stringify(value));
  } catch {
    /* 存储不可用时静默跳过，不影响主流程 */
  }
}

export function clearDraft(name: string): void {
  try {
    localStorage.removeItem(draftKey(name));
  } catch {
    /* 同上 */
  }
}

/** 自动把响应式对象同步到 localStorage 草稿 */
export function useLocalDraft<T extends object>(name: string, initial: T, deep = true): {
  draft: Ref<T>;
  savedAt: Ref<number | null>;
  reset: () => void;
  restore: () => T | null;
  flush: () => void;
} {
  const stored = readDraft<T>(name);
  const draft = ref({ ...initial, ...(stored ?? {}) }) as Ref<T>;
  const savedAt = ref<number | null>(stored ? Date.now() : null);

  const flush = () => {
    writeDraft(name, JSON.parse(JSON.stringify(draft.value)));
    savedAt.value = Date.now();
  };

  watch(
    draft,
    () => {
      flush();
    },
    { deep },
  );

  const reset = () => {
    draft.value = { ...initial };
    clearDraft(name);
    savedAt.value = null;
  };

  const restore = () => readDraft<T>(name);

  return { draft, savedAt, reset, restore, flush };
}
