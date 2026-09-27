/**
 * 拍摄进度：由实拍张数与废帧数计算镜头完成百分比与剩余张数。
 * 被 / 与 /progress 消费。
 */
import { computed, ref } from 'vue';
import * as api from '../db/api';
import { useShotStore } from '../stores/shotStore';
import { durationToFrames } from '../utils/frameMath';
import type { Shot } from '../types/shot';
import type { TakeLog, WasteBucket } from '../types/take';
import { createEmptyTake } from '../types/take';

export interface ShotProgressSummary {
  shotId: number;
  code: string;
  planned: number;
  taken: number;
  wasted: number;
  remaining: number;
  percent: number;
}

/** 纯函数：按实拍张数/废帧数算进度 */
export function computeProgress(planned: number, taken: number, wasted: number) {
  const total = Math.max(1, Math.floor(planned));
  const done = Math.max(0, Math.floor(taken));
  const bad = Math.max(0, Math.floor(wasted));
  const remaining = Math.max(0, total - done);
  const percent = Math.min(100, Math.round((done / total) * 100));
  return { planned: total, taken: done, wasted: bad, remaining, percent };
}

export function useProgress() {
  const shotStore = useShotStore();
  const takes = ref<TakeLog[]>([]);
  const loading = ref(false);

  const summaries = computed<ShotProgressSummary[]>(() =>
    shotStore.shots.map((shot) => {
      const planned = durationToFrames(shot.durationSec, shot.fps);
      const rows = takes.value.filter((t) => t.shotId === shot.id);
      const taken = rows.reduce((sum, r) => sum + (r.takenFrames || 0), 0);
      const wasted = rows.reduce((sum, r) => sum + (r.wastedFrames || 0), 0);
      const p = computeProgress(planned, taken, wasted);
      return { shotId: shot.id ?? 0, code: shot.code, ...p };
    }),
  );

  const overall = computed(() => {
    const planned = summaries.value.reduce((s, x) => s + x.planned, 0);
    const taken = summaries.value.reduce((s, x) => s + x.taken, 0);
    const wasted = summaries.value.reduce((s, x) => s + x.wasted, 0);
    const remaining = summaries.value.reduce((s, x) => s + x.remaining, 0);
    const percent = planned ? Math.min(100, Math.round((taken / planned) * 100)) : 0;
    return { planned, taken, wasted, remaining, percent };
  });

  /** 废帧分布：按张数区间分桶 */
  const wasteBuckets = computed<WasteBucket[]>(() => {
    const buckets: WasteBucket[] = [
      { label: '0 张', count: 0 },
      { label: '1-2 张', count: 0 },
      { label: '3-5 张', count: 0 },
      { label: '6 张以上', count: 0 },
    ];
    for (const row of takes.value) {
      const n = row.wastedFrames || 0;
      if (n === 0) buckets[0].count += 1;
      else if (n <= 2) buckets[1].count += 1;
      else if (n <= 5) buckets[2].count += 1;
      else buckets[3].count += 1;
    }
    return buckets;
  });

  async function loadTakes() {
    loading.value = true;
    try {
      takes.value = await api.listTakes();
    } finally {
      loading.value = false;
    }
  }

  function emptyTake(shot: Shot): TakeLog {
    const planned = durationToFrames(shot.durationSec, shot.fps);
    const rows = takes.value.filter((t) => t.shotId === shot.id);
    const taken = rows.reduce((sum, r) => sum + (r.takenFrames || 0), 0);
    const wasted = rows.reduce((sum, r) => sum + (r.wastedFrames || 0), 0);
    const p = computeProgress(planned, taken, wasted);
    return { ...createEmptyTake(shot.id ?? 0, shot.code), remainingFrames: p.remaining, percent: p.percent };
  }

  /** 登记一条实拍记录，并回写镜头完成百分比 */
  async function registerTake(shot: Shot, date: string, takenFrames: number, wastedFrames: number) {
    const planned = durationToFrames(shot.durationSec, shot.fps);
    const rows = takes.value.filter((t) => t.shotId === shot.id);
    const prevTaken = rows.reduce((sum, r) => sum + (r.takenFrames || 0), 0);
    const prevWasted = rows.reduce((sum, r) => sum + (r.wastedFrames || 0), 0);
    const p = computeProgress(planned, prevTaken + takenFrames, prevWasted + wastedFrames);
    const row: TakeLog = {
      date,
      shotCode: shot.code,
      shotId: shot.id ?? 0,
      takenFrames,
      wastedFrames,
      remainingFrames: p.remaining,
      percent: p.percent,
      updatedAt: Date.now(),
    };
    const id = await api.addTake(row);
    takes.value = [{ ...row, id }, ...takes.value];
    if (typeof shot.id === 'number') await shotStore.syncProgress(shot.id, p.percent);
    return { ...row, id };
  }

  async function removeTake(id: number) {
    await api.deleteTake(id);
    takes.value = takes.value.filter((t) => t.id !== id);
  }

  return {
    takes,
    loading,
    summaries,
    overall,
    wasteBuckets,
    loadTakes,
    emptyTake,
    registerTake,
    removeTake,
    computeProgress,
  };
}
