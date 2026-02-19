export const LAUNCH_YEAR = 2025;
export const LAUNCH_MONTH = 11;

export const isPeriodBeforeLaunch = (year: number, month: number) =>
  year < LAUNCH_YEAR || (year === LAUNCH_YEAR && month < LAUNCH_MONTH);

export const isPeriodAfterNow = (year: number, month: number, now = new Date()) =>
  year > now.getFullYear() || (year === now.getFullYear() && month > now.getMonth() + 1);

export const getYearOptionsDesc = (now = new Date()) =>
  Array.from({ length: now.getFullYear() - LAUNCH_YEAR + 1 }, (_, i) => now.getFullYear() - i);

export const getMonthOptionsForYear = (year: number, now = new Date()) => {
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1;

  if (year < LAUNCH_YEAR || year > currentYear) return [];

  const startMonth = year === LAUNCH_YEAR ? LAUNCH_MONTH : 1;
  const endMonth = year === currentYear ? currentMonth : 12;
  return Array.from({ length: endMonth - startMonth + 1 }, (_, i) => startMonth + i);
};

export const clampToValidPeriod = (year: number, month: number, now = new Date()) => {
  if (isPeriodBeforeLaunch(year, month)) return { year: LAUNCH_YEAR, month: LAUNCH_MONTH };
  if (isPeriodAfterNow(year, month, now)) return { year: now.getFullYear(), month: now.getMonth() + 1 };
  return { year, month };
};
