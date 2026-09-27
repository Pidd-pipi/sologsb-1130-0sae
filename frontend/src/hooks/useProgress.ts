/**
 * 拍摄进度：由实拍张数与废帧数计算镜头完成百分比与剩余张数。
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
  /** 累计已拍超过计划的张数 */
  overage: number;
  percent: number;
  /** 由实拍记录派生的镜头状态 */
  status: ShotStatus;
}

/** 纯函数：按累计实拍张数派生镜头状态——无记录未开机、未达标拍摄中、达标即已完成 */
export function deriveStatus(taken: number, planned: number): ShotStatus {
  const done = Math.max(0, Math.floor(taken));
  const total = Math.max(1, Math.floor(planned));
  if (done <= 0) return '未开机';
  if (done >= total) return '已完成';
  return '拍摄中';
}

/** 纯函数：按实拍张数/废帧数算进度 */
export function computeProgress(planned: number, taken: number, wasted: number) {
  const total = Math.max(1, Math.floor(planned));
  const done = Math.max(0, Math.floor(taken));
  const bad = Math.max(0, Math.floor(wasted));
  const remaining = Math.max(0, total - done);
  const overage = Math.max(0, done - total);
  const percent = Math.min(100, Math.round((done / total) * 100));
  const status = deriveStatus(done, total);
  return { planned: total, taken: done, wasted: bad, remaining, overage, percent, status };
}

/**
 * 按实拍记录重算单个镜头的完成百分比与状态并回写。
 * 直接读 IndexedDB，不依赖某个 useProgress 实例的 takes 缓存，
 * 因此删除记录、帧序增删导致计划数变化等入口都可安全调用。
 */
export async function recalcShotProgress(shotId: number): Promise<void> {
  const shotStore = useShotStore();
  const shot = shotStore.byId(shotId) ?? (await api.getShot(shotId));
  if (!shot) return;
  const rows = await api.listTakesByShot(shotId);
  const taken = rows.reduce((sum, r) => sum + (r.takenFrames || 0), 0);
  const wasted = rows.reduce((sum, r) => sum + (r.wastedFrames || 0), 0);
  const planned = durationToFrames(shot.durationSec, shot.fps);
  const p = computeProgress(planned, taken, wasted);
  if (shot.status === p.status && shot.progressPercent === p.percent) return;
  await shotStore.syncProgress(shotId, p.percent, p.status);
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
    const overage = summaries.value.reduce((s, x) => s + x.overage, 0);
    const percent = planned ? Math.min(100, Math.round((taken / planned) * 100)) : 0;
    return { planned, taken, wasted, remaining, overage, percent };
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

  /** 登记一条实拍记录，并把完成百分比与镜头状态回写到镜头 */
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
    if (typeof shot.id === 'number') await shotStore.syncProgress(shot.id, p.percent, p.status);
    return { ...row, id };
  }

  /** 删除一条实拍记录后，重新计算其镜头的完成百分比与状态 */
  async function removeTake(id: number) {
    const target = takes.value.find((t) => t.id === id);
    await api.deleteTake(id);
    takes.value = takes.value.filter((t) => t.id !== id);
    if (target && typeof target.shotId === 'number') await recalcShotProgress(target.shotId);
  }

  /** 依据当前实拍记录重算单个镜头的完成百分比与状态并回写（计划数变化后也走这里） */
  async function resyncShot(shotId: number) {
    await recalcShotProgress(shotId);
  }

  /** 把全部镜头的状态/百分比快照与实拍记录对齐（页面加载时兜底历史数据） */
  async function reconcileShots() {
    for (const summary of summaries.value) {
      const shot = shotStore.byId(summary.shotId);
      if (!shot) continue;
      if (shot.status !== summary.status || shot.progressPercent !== summary.percent) {
        await shotStore.syncProgress(summary.shotId, summary.percent, summary.status);
      }
    }
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
    resyncShot,
    reconcileShots,
    deriveStatus,
    computeProgress,
  };
}
