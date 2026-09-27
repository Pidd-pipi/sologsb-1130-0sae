/**
 * 帧序编排：插入 / 删除 / 移动帧并重排帧序号，联动镜头帧区间。
 * 被 /frames 与 /shots/:id 消费。
 */
import { computed } from 'vue';
import { storeToRefs } from 'pinia';
import { useFrameStore } from '../stores/frameStore';
import { useShotStore } from '../stores/shotStore';
import { durationToFrames, framesToDuration } from '../utils/frameMath';
import type { FrameEntry } from '../types/frame';

export function useFrameSequence() {
  const frameStore = useFrameStore();
  const shotStore = useShotStore();
  const { frames, selectedFrameNo } = storeToRefs(frameStore);

  const shotId = computed(() => frameStore.shotId);
  const shot = computed(() => (shotId.value === null ? undefined : shotStore.byId(shotId.value)));
  const fps = computed(() => shot.value?.fps ?? 24);
  const frameCount = computed(() => frames.value.length);
  const totalDuration = computed(() => framesToDuration(frameCount.value, fps.value));
  const plannedFrames = computed(() => durationToFrames(shot.value?.durationSec ?? 0, fps.value));

  async function insertAfter(frameNo: number | null) {
    const index = frameNo === null ? frames.value.length : frames.value.findIndex((f) => f.frameNo === frameNo) + 1;
    await frameStore.insertAt(Math.max(0, index));
    await syncShotRange();
  }

  async function removeAt(frameNo: number) {
    const index = frames.value.findIndex((f) => f.frameNo === frameNo);
    if (index < 0) return;
    await frameStore.removeAt(index);
    await syncShotRange();
  }

  async function move(fromIndex: number, toIndex: number) {
    await frameStore.move(fromIndex, toIndex);
    await syncShotRange();
  }

  /**
   * 帧序变化后重算镜头的帧区间与时长。
   * 帧区间与条带上的帧条目一一对应（结束帧号 = 起始帧号 + 帧条目数 - 1），
   * 时长 = 帧条目数 ÷ 帧率；新增帧即延长本段，删除帧即缩短本段。
   */
  async function syncShotRange() {
    if (shotId.value === null) return;
    const current = shotStore.byId(shotId.value);
    if (!current) return;
    const fps = current.fps || 24;
    const count = Math.max(1, frames.value.length);
    const seconds = Math.round((count / fps) * 1000) / 1000;
    await shotStore.update(shotId.value, {
      durationSec: seconds,
      startFrame: current.startFrame,
      endFrame: current.startFrame + count - 1,
    });
  }

  /** 条带上的单帧曝光/位移改动 */
  async function patch(frameNo: number, patchValue: Partial<FrameEntry>) {
    await frameStore.patchFrame(frameNo, patchValue);
  }

  function select(frameNo: number | null) {
    frameStore.select(frameNo);
  }

  return {
    frames,
    selectedFrameNo,
    shot,
    fps,
    frameCount,
    totalDuration,
    plannedFrames,
    insertAfter,
    removeAt,
    move,
    patch,
    select,
    syncShotRange,
    reload: (id: number) => frameStore.loadForShot(id),
  };
}
