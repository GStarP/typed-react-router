// `Object.keys` is not typed
export const typedKeys = <T extends object>(obj: T) => {
  return Object.keys(obj) as Array<keyof T>;
};

// arr.map(() => undefined || {}).filter(Boolean)
// quickly filter out `undefined`
export const filterOutFalsy = <T>(arr: T[]): Exclude<T, undefined>[] => {
  return arr.filter(Boolean) as Exclude<T, undefined>[];
};
