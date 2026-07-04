/** "12,480 words" */
export function formatWordCount(count?: number) {
  if (count === undefined) return "—";
  return `${count.toLocaleString("en-US")} words`;
}
