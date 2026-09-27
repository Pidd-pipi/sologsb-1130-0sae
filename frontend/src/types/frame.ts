/** 单帧拍摄张数（定格动画常用 1/2/3 张） */
export type ShotCount = 1 | 2 | 3;

export const SHOT_COUNT_OPTIONS: ShotCount[] = [1, 2, 3];

/** 帧条目：一帧的曝光参数、道具位移与实拍记录 */
export interface FrameEntry {
  id?: number;
  /** 帧序号，从 1 开始，随排序重排 */
  frameNo: number;
  /** 所属镜头 id */
  shotId: number;
  /** 拍摄张数 */
  shotCount: ShotCount;
  /** 曝光时间（秒） */
  exposureSec: number;
  /** 光圈 f 值 */
  aperture: number;
  /** 感光度 */
  iso: number;
  /** 快门角度（度） */
  shutterAngle: number;
  /** 灯光配置 */
  lighting: string;
  /** 道具位移量（mm） */
  propOffsetMm: number;
  /** 备注 */
  note: string;
  updatedAt: number;
}

export const createEmptyFrame = (shotId: number, frameNo: number): FrameEntry => ({
  frameNo,
  shotId,
  shotCount: 2,
  exposureSec: 0.25,
  aperture: 5.6,
  iso: 200,
  shutterAngle: 180,
  lighting: '主灯 + 柔光箱',
  propOffsetMm: 0,
  note: '',
  updatedAt: Date.now(),
});

/** 批量曝光设置（供 /frames 编排台使用） */
export interface BatchExposure {
  exposureSec: number;
  aperture: number;
  iso: number;
  shutterAngle: number;
}
