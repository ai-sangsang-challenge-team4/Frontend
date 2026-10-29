// The backend serialises LocalDateTime without a zone (e.g. 2026-10-28T12:18:23.227) in the server's
// local time, which is KST. new Date() would read that as the browser's local time, so the KST offset
// is attached before parsing. Values that already carry a zone are returned unchanged.
const ZONE_SUFFIX = /(?:Z|[+-]\d{2}:?\d{2})$/i;

export function toServerInstant(value: string): string;
export function toServerInstant(value: string | null | undefined): string | undefined;
export function toServerInstant(value: string | null | undefined) {
  if (!value) return undefined;
  return ZONE_SUFFIX.test(value) ? value : `${value}+09:00`;
}
