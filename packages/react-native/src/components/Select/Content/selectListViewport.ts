/** Keep short Select lists fully visible while bounding long lists. */
export const resolveSelectListViewportHeight = (
  estimatedHeight: number,
  measuredHeight: number,
  maximumHeight: number
): number => {
  const actual = Number.isFinite(measuredHeight)
    ? Math.max(0, measuredHeight)
    : 0;
  return Math.min(maximumHeight, Math.max(estimatedHeight, actual));
};
