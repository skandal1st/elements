/**
 * Форматирует ISO datetime в относительное время: «только что», «N мин назад», «N ч назад», «вчера», «N дн. назад».
 * Для null возвращает «—».
 */
export function formatRelative(isoDate: string | null): string {
  if (!isoDate || !isoDate.trim()) return "—";
  const date = new Date(isoDate);
  if (Number.isNaN(date.getTime())) return "—";
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHour = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHour / 24);

  if (diffSec < 60) return "только что";
  if (diffMin < 60) return diffMin === 1 ? "1 мин назад" : `${diffMin} мин назад`;
  if (diffHour < 24) return diffHour === 1 ? "1 ч назад" : `${diffHour} ч назад`;
  if (diffDay === 1) return "вчера";
  return `${diffDay} дн. назад`;
}
