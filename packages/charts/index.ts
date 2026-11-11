export function sparkline(values: number[], width = 200, height = 50) {
  if (!values.length) return "";
  const min = Math.min(...values),
    range = Math.max(...values) - min || 1;
  return values
    .map(
      (v, i) =>
        `${(i * width) / Math.max(1, values.length - 1)},${height - 5 - ((v - min) / range) * (height - 10)}`,
    )
    .join(" ");
}
