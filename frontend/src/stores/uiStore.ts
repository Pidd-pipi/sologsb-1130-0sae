/** 全局 UI 状态：加载态、全局提示、最近一次错误 */
import { defineStore } from 'pinia';

export type NoticeType = 'success' | 'warning' | 'error' | 'info';

interface Notice {
  type: NoticeType;
  text: string;
  at: number;
}

interface UiState {
  loading: boolean;
  notice: Notice | null;
  lastError: string;
}

export const useUiStore = defineStore('ui', {
  state: (): UiState => ({
    loading: false,
    notice: null,
    lastError: '',
  }),
  actions: {
    setLoading(value: boolean) {
      this.loading = value;
    },
    notify(type: NoticeType, text: string) {
      this.notice = { type, text, at: Date.now() };
      if (type === 'error') this.lastError = text;
    },
    clearNotice() {
      this.notice = null;
    },
  },
});
