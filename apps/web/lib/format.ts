const locale = 'vi-VN';
const timeZone = 'Asia/Ho_Chi_Minh';
const number = new Intl.NumberFormat(locale);
const dateTime = new Intl.DateTimeFormat(locale, {
  timeZone,
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
});
const clockTime = new Intl.DateTimeFormat(locale, {
  timeZone,
  timeStyle: 'medium',
});

export function formatVnd(amount: number | bigint) {
  return `${number.format(amount)} ₫`;
}

export function formatKg(amount: number) {
  return `${number.format(amount)} kg`;
}

export function formatDateTime(iso: string) {
  return dateTime.format(new Date(iso));
}

export function formatClockTime(iso: string) {
  return clockTime.format(new Date(iso));
}

export function formatCalendarDate(value: string) {
  const [year, month, day] = value.slice(0, 10).split('-');
  return `${day}/${month}/${year}`;
}

export function formatLiters(amount: number) {
  return `${number.format(amount)} L`;
}
