/**
 * 曝光参数换算与越界提示。
 * 以标准曝光基准（ISO 100 / 1s / f1.0 / 快门角度 180°）折算曝光值 EV，
 * 仅用于提示与校验，不做任何图像处理。
 */
import type { FrameEntry } from '../types/frame';

export const STANDARD_SHUTTER_ANGLE = 180;

/** 曝光时间可选档位（秒） */
export const EXPOSURE_OPTIONS = [0.008, 0.016, 0.033, 0.0625, 0.125, 0.25, 0.5, 1, 2, 4];

/** 光圈可选档位 */
export const APERTURE_OPTIONS = [1.4, 2, 2.8, 4, 5.6, 8, 11, 16, 22];

/** ISO 可选档位 */
export const ISO_OPTIONS = [100, 200, 400, 800, 1600, 3200];

/** 快门角度可选档位 */
export const SHUTTER_ANGLE_OPTIONS = [45, 90, 144, 172.8, 180, 270, 360];

/** 快门角度换算成的有效曝光时间（秒） */
export function shutterAngleToSeconds(exposureSec: number, shutterAngle: number): number {
  if (!Number.isFinite(exposureSec) || !Number.isFinite(shutterAngle)) return 0;
  return (exposureSec * shutterAngle) / STANDARD_SHUTTER_ANGLE;
}

/**
 * 等效曝光值：数值越大代表进光越多（相对基准的档数）。
 * ev = log2( (iso/100) * (1/exposureSec) * (1/aperture^2) )
 */
export function exposureValue(exposureSec: number, aperture: number, iso: number): number {
  if (exposureSec <= 0 || aperture <= 0 || iso <= 0) return 0;
  const ev = Math.log2((iso / 100) * (1 / exposureSec) * (1 / (aperture * aperture)));
  return Math.round(ev * 100) / 100;
}

/** 基于帧率给出该帧的建议曝光时间（180° 快门） */
export function suggestExposure(fps: number): number {
  if (!Number.isFinite(fps) || fps <= 0) return 0.125;
  const half = 0.5 / fps;
  return EXPOSURE_OPTIONS.reduce((best, cur) => (Math.abs(cur - half) < Math.abs(best - half) ? cur : best), EXPOSURE_OPTIONS[0]);
}

export interface ExposureWarning {
  field: 'exposureSec' | 'aperture' | 'iso' | 'shutterAngle';
  message: string;
}

/** 越界与风险提示：返回空数组表示参数合法 */
export function checkExposure(frame: Pick<FrameEntry, 'exposureSec' | 'aperture' | 'iso' | 'shutterAngle'>, fps = 24): ExposureWarning[] {
  const warnings: ExposureWarning[] = [];
  if (!(frame.exposureSec > 0) || frame.exposureSec > 8) {
    warnings.push({ field: 'exposureSec', message: '曝光时间需在 0.008s ~ 8s 之间' });
  }
  if (!(frame.aperture >= 1.4) || frame.aperture > 22) {
    warnings.push({ field: 'aperture', message: '光圈 f 值需在 1.4 ~ 22 之间' });
  }
  if (!(frame.iso >= 100) || frame.iso > 3200) {
    warnings.push({ field: 'iso', message: 'ISO 需在 100 ~ 3200 之间' });
  }
  if (!(frame.shutterAngle >= 45) || frame.shutterAngle > 360) {
    warnings.push({ field: 'shutterAngle', message: '快门角度需在 45° ~ 360° 之间' });
  }
  const effective = shutterAngleToSeconds(frame.exposureSec, frame.shutterAngle);
  const frameInterval = fps > 0 ? 1 / fps : 0.0417;
  // 留 1ms 容差，避免档位取整（如 0.016s × 180°/24fps）被误判为串帧
  if (effective > 0 && frameInterval > 0 && effective - frameInterval > 0.001) {
    warnings.push({
      field: 'shutterAngle',
      message: `有效曝光 ${effective.toFixed(3)}s 超过单帧间隔 ${frameInterval.toFixed(3)}s，实拍会串帧`,
    });
  }
  return warnings;
}

/** 相对于参考曝光（同镜头首个帧条目）需要补正的档数 */
export function stopsAgainstReference(
  frame: Pick<FrameEntry, 'exposureSec' | 'aperture' | 'iso'>,
  reference: Pick<FrameEntry, 'exposureSec' | 'aperture' | 'iso'>,
): number {
  const a = exposureValue(frame.exposureSec, frame.aperture, frame.iso);
  const b = exposureValue(reference.exposureSec, reference.aperture, reference.iso);
  return Math.round((a - b) * 100) / 100;
}
