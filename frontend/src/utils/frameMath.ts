/**
 * 帧号 / 时长 / 位移的换算工具。
 * 定格动画以「张数」计帧，时长为 张数 ÷ 帧率。
 */

/** 时长（秒）换算成所需张数，向上取整，至少 1 张 */
export function durationToFrames(durationSec: number, fps: number): number {
  if (!Number.isFinite(durationSec) || !Number.isFinite(fps) || fps <= 0) return 1;
  return Math.max(1, Math.ceil(durationSec * fps));
}

/** 张数换算成时长（秒），保留三位小数 */
export function framesToDuration(frames: number, fps: number): number {
  if (!Number.isFinite(frames) || !Number.isFinite(fps) || fps <= 0) return 0;
  return Math.round((frames / fps) * 1000) / 1000;
}

/** 由起始帧号与时长算出区间；起始帧号非法时回落到 1 */
export function buildFrameRange(startFrame: number, durationSec: number, fps: number) {
  const start = Number.isFinite(startFrame) && startFrame >= 1 ? Math.floor(startFrame) : 1;
  const count = durationToFrames(durationSec, fps);
  return { startFrame: start, endFrame: start + count - 1, frameCount: count };
}

/** 秒 → 时间码 00:00:00.000 风格的可读文本 */
export function secondsToTimecode(seconds: number): string {
  const total = Math.max(0, Math.round(seconds * 1000));
  const s = Math.floor(total / 1000);
  const ms = total % 1000;
  const mm = Math.floor(s / 60);
  const ss = s % 60;
  return `${String(mm).padStart(2, '0')}:${String(ss).padStart(2, '0')}.${String(ms).padStart(3, '0')}`;
}

/** 一帧的位移速度估算（mm/s），用于判断运动是否过冲 */
export function estimateSpeed(offsetMm: number, fps: number): number {
  if (!Number.isFinite(offsetMm) || !Number.isFinite(fps) || fps <= 0) return 0;
  return Math.round(offsetMm * fps * 100) / 100;
}

/** 位移量按帧累积：返回每个帧号对应的累计位移（mm） */
export function accumulateOffsets(offsets: number[]): number[] {
  let acc = 0;
  return offsets.map((v) => {
    acc += Number.isFinite(v) ? v : 0;
    return Math.round(acc * 100) / 100;
  });
}

/** 条带颜色入参：只需要位移量与曝光时间两个字段 */
export interface FrameColorInput {
  propOffsetMm: number;
  exposureSec: number;
}

/** 条带颜色：按位移量与曝光时间给帧上色（纯 CSS 色值，不涉及图像处理） */
export function frameColor(frame: FrameColorInput): string {
  const shift = Math.min(1, Math.abs(frame.propOffsetMm) / 20);
  const light = Math.min(1, Math.max(0, (frame.exposureSec - 0.03) / 0.6));
  const hue = 205 - shift * 145;
  const lightness = 46 + light * 26;
  return `hsl(${hue.toFixed(0)}, 62%, ${lightness.toFixed(0)}%)`;
}

/** 均匀分布在 [min, max] 之间的 n 个刻度值 */
export function spreadValues(n: number, min: number, max: number): number[] {
  if (n <= 1) return [min];
  const step = (max - min) / (n - 1);
  return Array.from({ length: n }, (_, i) => Math.round((min + step * i) * 100) / 100);
}

/** 基于帧条目生成平滑的位移曲线路径点（用于 SVG 折线预览） */
export function buildCurvePoints(values: number[], width: number, height: number, padding = 8) {
  if (values.length === 0) return '';
  const max = Math.max(...values, 1);
  const min = Math.min(...values, 0);
  const span = max - min || 1;
  const stepX = values.length > 1 ? (width - padding * 2) / (values.length - 1) : 0;
  return values
    .map((v, i) => {
      const x = padding + stepX * i;
      const y = height - padding - ((v - min) / span) * (height - padding * 2);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(' ');
}
