export type RecursiveMap<T, MaxDepth extends number> = {
  [k: string]: RecursiveMap_<T, MaxDepth, []>;
};

// every time `RecursiveMap_` nest a new level, `Stack['length']` will increase 1
// when it reaches `MaxDepth`, nesting will be blocked
type RecursiveMap_<
  T,
  MaxDepth extends number,
  Stack extends unknown[]
> = MaxDepth extends Stack['length']
  ? T
  : T | { [k: string]: RecursiveMap_<T, MaxDepth, [1, ...Stack]> };

// `number` can also convert to `string`
export type StringLike = {
  toString: () => string;
};
// @example
// const test: StringLike = 1

// union object values' types
export type Values<T extends object> = T[keyof T];
// @example
// const o = { a: 'a', b: 1, c: true}
// type test = Values<typeof o>
