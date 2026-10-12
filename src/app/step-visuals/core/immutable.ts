/** Freeze newly constructed plain scene data; callers must not pass owned input objects. */
export const immutable = <T>(value: T): T => {
  if (value !== null && typeof value === "object") {
    Object.values(value).forEach(immutable);
    Object.freeze(value);
  }
  return value;
};
