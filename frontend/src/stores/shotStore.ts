/** 镜头 store：镜头增删改查、按帧率与时长排帧区间 */
import { defineStore } from 'pinia';
import * as api from '../db/api';
import { toPlain } from '../db';
import { buildFrameRange, framesToDuration } from '../utils/frameMath';
import type { Shot } from '../types/shot';
import { createEmptyShot } from '../types/shot';
import type { FrameEntry } from '../types/frame';
import { createEmptyFrame } from '../types/frame';

interface ShotState {
  shots: Shot[];
  currentId: number | null;
  ready: boolean;
}

export const useShotStore = defineStore('shot', {
  state: (): ShotState => ({
    shots: [],
    currentId: null,
    ready: false,
  }),
  getters: {
    current(state): Shot | undefined {
      return state.shots.find((s) => s.id === state.currentId);
    },
    byId(state) {
      return (id: number) => state.shots.find((s) => s.id === id);
    },
    totalPlannedFrames(state): number {
      return state.shots.reduce((sum, s) => sum + (s.endFrame - s.startFrame + 1), 0);
    },
    finishedShots(state): number {
      return state.shots.filter((s) => s.status === '已完成').length;
    },
    totalSeconds(state): number {
      return Math.round(state.shots.reduce((sum, s) => sum + framesToDuration(s.endFrame - s.startFrame + 1, s.fps), 0) * 100) / 100;
    },
  },
  actions: {
    async load() {
      try {
        this.shots = await api.listShots();
        this.ready = true;
      } catch (e) {
        this.shots = [];
        this.ready = true;
        throw e;
      }
    },
    async create(payload: Partial<Shot>): Promise<Shot> {
      const base = { ...createEmptyShot(), ...payload };
      const range = buildFrameRange(base.startFrame, base.durationSec, base.fps);
      const shot: Shot = toPlain({
        ...base,
        startFrame: range.startFrame,
        endFrame: range.endFrame,
        progressPercent: 0,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
      const id = await api.addShot(shot);
      const saved: Shot = { ...shot, id };
      this.shots = [...this.shots, saved].sort((a, b) => a.code.localeCompare(b.code, 'zh-Hans-CN'));
      this.currentId = id;
      return saved;
    },
    /** 改时长/帧率后重排帧区间，并同步到该镜头的全部帧条目 */
    async update(id: number, patch: Partial<Shot>) {
      const existing = this.shots.find((s) => s.id === id);
      if (!existing) return;
      const next = toPlain({ ...existing, ...patch });
      const range = buildFrameRange(next.startFrame, next.durationSec, next.fps);
      next.startFrame = range.startFrame;
      next.endFrame = range.endFrame;
      await api.updateShot(id, next);
      this.shots = this.shots.map((s) => (s.id === id ? { ...next, id } : s));
      await this.rerangeFrames(id);
    },
    /** 把帧序号重新压缩进 [startFrame, endFrame]，并重算时长 */
    async rerangeFrames(shotId: number) {
      const shot = this.shots.find((s) => s.id === shotId);
      if (!shot) return;
      const rows = await api.listFrames(shotId);
      const next = rows
        .slice()
        .sort((a, b) => a.frameNo - b.frameNo)
        .map((row, idx) => ({ ...row, frameNo: shot.startFrame + idx }));
      await api.updateFrames(next);
    },
    async setStatus(id: number, status: Shot['status']) {
      await api.updateShot(id, { status });
      this.shots = this.shots.map((s) => (s.id === id ? { ...s, status, updatedAt: Date.now() } : s));
    },
    async syncProgress(id: number, percent: number) {
      await api.syncShotProgress(id, percent);
      this.shots = this.shots.map((s) => (s.id === id ? { ...s, progressPercent: percent } : s));
    },
    async remove(id: number) {
      await api.deleteShot(id);
      this.shots = this.shots.filter((s) => s.id !== id);
      if (this.currentId === id) this.currentId = null;
    },
    /** 依据时长给出帧区间预览（不落库） */
    previewRange(startFrame: number, durationSec: number, fps: number) {
      return buildFrameRange(startFrame, durationSec, fps);
    },
  },
});

/** 新建镜头时生成首个帧条目 */
export function firstFrameOf(shot: Shot): FrameEntry {
  const frame = createEmptyFrame(shot.id ?? 0, shot.startFrame);
  return frame;
}
