/** 镜头拍摄状态 */
export type ShotStatus = '未开机' | '拍摄中' | '已完成';

export const SHOT_STATUS_OPTIONS: ShotStatus[] = ['未开机', '拍摄中', '已完成'];

/** 可选帧率 */
export const FPS_OPTIONS = [8, 12, 15, 24, 25, 30] as const;

/** 镜头（一个可独立拍摄的定格动画分镜单元） */
export interface Shot {
  id?: number;
  /** 镜号，如 S01 */
  code: string;
  /** 场景名 */
  sceneName: string;
  /** 帧率 */
  fps: number;
  /** 预计时长（秒） */
  durationSec: number;
  /** 起始帧号 */
  startFrame: number;
  /** 结束帧号 */
  endFrame: number;
  /** 拍摄状态 */
  status: ShotStatus;
  /** 负责人 */
  owner: string;
  /** 完成百分比快照（由实拍记录回写，0-100） */
  progressPercent: number;
  /** 创建时间戳 */
  createdAt: number;
  updatedAt: number;
}

export const createEmptyShot = (): Shot => ({
  code: '',
  sceneName: '',
  fps: 24,
  durationSec: 2,
  startFrame: 1,
  endFrame: 48,
  status: '未开机',
  owner: '',
  progressPercent: 0,
  createdAt: Date.now(),
  updatedAt: Date.now(),
});
