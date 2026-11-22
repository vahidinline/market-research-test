// Missing measurements must not be presented as a measured zero.
export function formatScore100(value) {
  if (typeof value !== 'number' || !Number.isFinite(value)) return 'نامشخص';
  return `${Number(value.toFixed(1))}/100`;
}
