import { formatCalendarDate } from '../../lib/format';

export function CalendarDate({ value }: { value: string }) {
  const isoDate = value.slice(0, 10);

  return <time dateTime={isoDate}>{formatCalendarDate(isoDate)}</time>;
}
