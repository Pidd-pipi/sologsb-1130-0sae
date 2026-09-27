/** 道具固定方式 */
export type Fixation = '支架' | '磁吸' | '黏土';

export const FIXATION_OPTIONS: Fixation[] = ['支架', '磁吸', '黏土'];

/** 道具状态：某个道具在一段帧区间内的空间位置 */
export interface PropState {
  id?: number;
  /** 道具名 */
  name: string;
  /** 所属镜头 id */
  shotId: number;
  /** 适用帧区间起点 */
  fromFrame: number;
  /** 适用帧区间终点 */
  toFrame: number;
  /** 位置 X（mm） */
  posX: number;
  /** 位置 Y（mm） */
  posY: number;
  /** 位置 Z（mm） */
  posZ: number;
  /** 旋转角度（度） */
  rotation: number;
  /** 固定方式 */
  fixation: Fixation;
  updatedAt: number;
}

export const createEmptyProp = (shotId: number): PropState => ({
  name: '',
  shotId,
  fromFrame: 1,
  toFrame: 24,
  posX: 0,
  posY: 0,
  posZ: 0,
  rotation: 0,
  fixation: '支架',
  updatedAt: Date.now(),
});
