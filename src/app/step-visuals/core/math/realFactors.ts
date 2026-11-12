export type LinearFactor = Readonly<{ id: string; root: number }>;

export const finiteNumber = (value: number): number => {
  if (!Number.isFinite(value)) throw new RangeError("Expected a finite mathematical value.");
  return value === 0 ? 0 : value;
};

export const formatNumber = (value: number): string => String(finiteNumber(value)).replace("-", "−");

export const evaluateFactor = (factor: LinearFactor, x: number): number =>
  finiteNumber(finiteNumber(x) - finiteNumber(factor.root));

export const formatFactor = (factor: LinearFactor): string => {
  const root = finiteNumber(factor.root);
  return root === 0 ? "(x)" : `(x ${root < 0 ? "+" : "−"} ${formatNumber(Math.abs(root))})`;
};
