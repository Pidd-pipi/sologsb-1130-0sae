/** 帧条目 store：条带选中、帧序数组、批量曝光、持久化 */
import { defineStore } from 'pinia';
import * as api from '../db/api';
import { toPlain } from '../db';
import { accumulateOffsets, estimateSpeed, frameColor, framesToDuration } from '../utils/frameMath';
import type { BatchExposure, FrameEntry } from '../types/frame';
import { createEmptyFrame } from '../types/frame';

interface FrameState {
  frames: FrameEntry[];
  shotId: number | null;
  selectedFrameNo: number | null;
  dirty: boolean;
}

export const useFrameStore = defineStore('frame', {
  state: (): FrameState => ({
    frames: [],
    shotId: null,
    selectedFrameNo: null,
    dirty: false,
  }),
  getters: {
    count(state): number {
      return state.frames.length;
    },
    selected(state): FrameEntry | undefined {
      if (state.selectedFrameNo === null) return undefined;
      return state.frames.find((f) => f.frameNo === state.selectedFrameNo);
    },
    /** 全部帧的累计位移轨迹（mm） */
    offsets(state): number[] {
      return accumulateOffsets(state.frames.map((f) => f.propOffsetMm));
    },
    /** 整段帧序按张数折算的总时长（秒） */
    totalDuration(state): number {
      return Math.round(state.frames.reduce((sum, f) => sum + 1 / (f.shotCount || 1), 0) * 100) / 100;
    },
    /** 帧序在给定帧率下的实际时长（秒） */
    durationAtFps(state) {
      return (fps: number) => framesToDuration(state.frames.length, fps);
    },
  },
  actions: {
    async loadForShot(shotId: number) {
      this.shotId = shotId;
      this.frames = await api.listFrames(shotId);
      this.dirty = false;
      if (this.frames.length && !this.frames.some((f) => f.frameNo === this.selectedFrameNo)) {
        this.selectedFrameNo = this.frames[0].frameNo;
      }
    },
    select(frameNo: number | null) {
      this.selectedFrameNo = frameNo;
    },
    /** 整段帧序落库（脱代理后写入），帧序号按数组顺序重排 */
    async persist() {
      if (this.shotId === null) return;
      const ordered = this.frames.map((f, idx) => ({ ...f, frameNo: idx + 1, shotId: this.shotId as number }));
      await api.replaceShotFrames(this.shotId, toPlain(ordered));
      this.frames = await api.listFrames(this.shotId);
      this.dirty = false;
    },
    async insertAt(index: number, seed?: Partial<FrameEntry>) {
      const base = createEmptyFrame(this.shotId ?? 0, index + 1);
      const anchor = this.frames[index - 1] ?? this.frames[0];
      const merged: FrameEntry = {
        ...base,
        ...(anchor
          ? {
              shotCount: anchor.shotCount,
              exposureSec: anchor.exposureSec,
              aperture: anchor.aperture,
              iso: anchor.iso,
              shutterAngle: anchor.shutterAngle,
              lighting: anchor.lighting,
            }
          : {}),
        ...seed,
        frameNo: index + 1,
        id: undefined,
      };
      this.frames = [...this.frames.slice(0, index), merged, ...this.frames.slice(index)];
      this.frames = this.frames.map((f, idx) => ({ ...f, frameNo: idx + 1 }));
      this.dirty = true;
      await this.persist();
    },
    async removeAt(index: number) {
      if (this.frames.length <= 1) return;
      this.frames = this.frames.filter((_, i) => i !== index);
      this.frames = this.frames.map((f, idx) => ({ ...f, frameNo: idx + 1 }));
      this.dirty = true;
      await this.persist();
    },
    async move(from: number, to: number) {
      if (from === to || from < 0 || to < 0 || from >= this.frames.length || to >= this.frames.length) return;
      const next = this.frames.slice();
      const [moved] = next.splice(from, 1);
      next.splice(to, 0, moved);
      this.frames = next.map((f, idx) => ({ ...f, frameNo: idx + 1 }));
      this.dirty = true;
      await this.persist();
    },
    /** 批量套用曝光参数 */
    async applyBatch(batch: BatchExposure, indexes?: number[]) {
      const target = indexes && indexes.length ? new Set(indexes) : null;
      this.frames = this.frames.map((f, idx) => {
        if (target && !target.has(idx)) return f;
        return {
          ...f,
          exposureSec: batch.exposureSec,
          aperture: batch.aperture,
          iso: batch.iso,
          shutterAngle: batch.shutterAngle,
          updatedAt: Date.now(),
        };
      });
      await this.persist();
    },
    /** 就地更新单帧字段（镜头详情页表格 / 条带位移量） */
    async patchFrame(frameNo: number, patch: Partial<FrameEntry>) {
      const idx = this.frames.findIndex((f) => f.frameNo === frameNo);
      if (idx < 0) return;
      const next = { ...this.frames[idx], ...patch, updatedAt: Date.now() };
      this.frames = this.frames.map((f, i) => (i === idx ? next : f));
      if (typeof next.id === 'number') {
        const { id, ...rest } = next;
        await api.updateFrame(id, toPlain(rest));
      }
    },
    /** 条带单帧颜色：按曝光与位移量着色 */
    colorOf(frame: FrameEntry): string {
      return frameColor({ propOffsetMm: frame.propOffsetMm, exposureSec: frame.exposureSec });
    },
    speedOf(frame: FrameEntry, fps: number): number {
      return estimateSpeed(frame.propOffsetMm, fps);
    },
  },
});
