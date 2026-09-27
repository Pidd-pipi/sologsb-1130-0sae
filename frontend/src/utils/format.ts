/** 通用格式化工具 */

/** 帧号格式化：3 位左补零 */
export function formatFrameNo(no: number): string {
  return String(Math.max(1, Math.floor(no))).padStart(3, '0');
}

/** 秒格式化，保留两位小数 */
export function formatSeconds(sec: number): string {
  if (!Number.isFinite(sec)) return '0.00';
  return sec.toFixed(2);
}

/** 毫米格式化 */
export function formatMm(mm: number): string {
  if (!Number.isFinite(mm)) return '0 mm';
  return `${mm.toFixed(1)} mm`;
}

/** 百分比格式化 0-100 */
export function formatPercent(value: number): string {
  if (!Number.isFinite(value)) return '0%';
  return `${Math.round(Math.min(100, Math.max(0, value)))}%`;
}

/** 时间戳 → YYYY-MM-DD HH:mm */
export function formatDateTime(ts: number): string {
  const d = new Date(ts);
  if (Number.isNaN(d.getTime())) return '-';
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

/** 今天的 YYYY-MM-DD */
export function today(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/** 数字安全夹取 */
export function clamp(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, value));
}
