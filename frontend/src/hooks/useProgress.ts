/**
 * 拍摄进度：由实拍张数与废帧数计算镜头完成百分比与剩余张数，
 * 并把进度快照与拍摄状态回写到镜头，保证详情 / 总览 / 实拍页一致。
 * 被 / 与 /progress 消费。
 */
import { computed, ref } from 'vue';
import * as api from '../db/api';
import { useShotStore } from '../stores/shotStore';
import { durationToFrames } from '../utils/frameMath';
import type { Shot, ShotStatus } from '../types/shot';
import type { TakeLog, WasteBucket } from '../types/take';
import { createEmptyTake } from '../types/take';

export interface ShotProgressSummary {
  shotId: number;
  code: string;
  planned: number;
  taken: number;
  wasted: number;
  remaining: number;
  /** 累计已拍超出计划的张数（未超出为 0） */
  over: number;
  percent: number;
}

/** 纯函数：按实拍张数/废帧数算进度；已拍超过计划时保留实拍数并给出超出量 */
export function computeProgress(planned: number, taken: number, wasted: number) {
  const total = Math.max(1, Math.floor(planned));
  const done = Math.max(0, Math.floor(taken));
  const bad = Math.max(0, Math.floor(wasted));
  const remaining = Math.max(0, total - done);
  const over = Math.max(0, done - total);
  const percent = Math.min(100, Math.round((done / total) * 100));
  return { planned: total, taken: done, wasted: bad, remaining, over, percent };
}

/** 纯函数：由累计实拍张数推导镜头状态——达标已完成、有记录拍摄中、无记录未开机 */
export function statusForProgress(taken: number, planned: number): ShotStatus {
  const total = Math.max(1, Math.floor(planned));
  const done = Math.max(0, Math.floor(taken));
  if (done >= total) return '已完成';
  if (done > 0) return '拍摄中';
  return '未开机';
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
      // 以实拍记录为准校正所有镜头的进度快照与状态，修复历史遗留的不一致
      for (const shot of shotStore.shots) {
        if (typeof shot.id === 'number') await syncShot(shot.id);
      }
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

  /** 登记一条实拍记录，并回写镜头完成百分比与拍摄状态 */
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
    if (typeof shot.id === 'number') await syncShot(shot.id);
    return { ...row, id };
  }

  /** 删除一条实拍记录后，按剩余记录重算镜头进度与状态（全部移除则回到未开机） */
  async function removeTake(id: number) {
    const row = takes.value.find((t) => t.id === id);
    await api.deleteTake(id);
    takes.value = takes.value.filter((t) => t.id !== id);
    if (row) await syncShot(row.shotId);
  }

  /** 按当前实拍记录汇总，把完成百分比与推导出的状态回写到镜头（有变化才写库） */
  async function syncShot(shotId: number) {
    const shot = shotStore.byId(shotId);
    if (!shot || typeof shot.id !== 'number') return;
    const planned = durationToFrames(shot.durationSec, shot.fps);
    const rows = takes.value.filter((t) => t.shotId === shotId);
    const taken = rows.reduce((sum, r) => sum + (r.takenFrames || 0), 0);
    const wasted = rows.reduce((sum, r) => sum + (r.wastedFrames || 0), 0);
    const p = computeProgress(planned, taken, wasted);
    const status = statusForProgress(p.taken, p.planned);
    if (shot.progressPercent === p.percent && shot.status === status) return;
    await shotStore.syncProgress(shotId, p.percent, status);
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
    statusForProgress,
  };
}
