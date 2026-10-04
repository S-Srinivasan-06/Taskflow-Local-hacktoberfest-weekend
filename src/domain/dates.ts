const LOCAL_DATE_TIME = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/;
const UTC_DATE_TIME = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/;

export function toLocalIsoWithoutOffset(date: Date): string {
  if (!Number.isFinite(date.getTime())) throw new Error('Invalid date/time');
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${String(date.getFullYear()).padStart(4, '0')}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}

export function localIsoToUtc(value: string): string {
  if (typeof value !== 'string' || !LOCAL_DATE_TIME.test(value)) {
    throw new Error('Use a local date and time in YYYY-MM-DDTHH:mm:ss format');
  }
  const parsed = new Date(value);
  // Reject calendar overflow and nonexistent times during daylight-saving changes.
  if (!Number.isFinite(parsed.getTime()) || toLocalIsoWithoutOffset(parsed) !== value) {
    throw new Error('Invalid local date/time');
  }
  return parsed.toISOString();
}

export function normalizeUtcDateTime(value: string): string {
  if (typeof value !== 'string' || !UTC_DATE_TIME.test(value)) {
    throw new Error('Use a UTC date and time');
  }
  const parsed = new Date(value);
  const expected = value.includes('.') ? value : value.replace('Z', '.000Z');
  if (!Number.isFinite(parsed.getTime()) || parsed.toISOString() !== expected) {
    throw new Error('Invalid UTC date/time');
  }
  return parsed.toISOString();
}
