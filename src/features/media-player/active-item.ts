type TimestampedItem = { id: string; timestampSeconds: number };

/**
 * Id of the last item at or before `currentTime`, for highlighting the
 * "now playing" transcript block / conversation turn / timeline event.
 * `items` is assumed sorted ascending by `timestampSeconds`, which holds for
 * transcript blocks, conversation turns, and timeline events as returned
 * today. Returns `undefined` before the first item or when `items` is
 * empty, so callers render no highlight rather than a wrong one.
 */
export function findActiveTimestampId<T extends TimestampedItem>(
  items: T[],
  currentTime: number,
): string | undefined {
  let activeId: string | undefined;
  for (const item of items) {
    if (item.timestampSeconds > currentTime) break;
    activeId = item.id;
  }
  return activeId;
}
