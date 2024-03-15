import { Fn, Pipe, Strings, Tuples } from 'hotscript';
import { RecursiveMap, StringLike, Values } from './utils.type';

// most basic type, represent a route in our type system
export type RawRoute = `/${string}`;

// ! not support nesting route over 10 levels
export type RawRoutesMap = RecursiveMap<RawRoute, 10>;

// extract type for route params
export type RouteParams<Route extends RawRoute> = Pipe<
  Route,
  [
    Strings.Split<'/'>,
    Tuples.Filter<Strings.StartsWith<':'>>,
    Tuples.Map<Strings.TrimLeft<':'>>,
    Tuples.ToUnion
  ]
>;
// @example
// type test = RouteParams<'/user/:id/:name'>;

// extract route params in `Route` and build a map for it
export type RouteParamsMap<
  Route extends RawRoute,
  Val extends string | StringLike = string
> = {
  [k in RouteParams<Route>]: Val;
};

export type SearchAndHash = {
  hash?: string;
  search?:
    | string
    | {
        [k: string]: string;
      };
};

// this will be used as params for a function
// it must have a `RouteParamsMap` and it may have `SearchAndHashParams`
export type PathConstructorParams<R extends RawRoute> =
  | [RouteParamsMap<R, StringLike>]
  | [RouteParamsMap<R, StringLike>, SearchAndHash];

// util: replace `:xxx` with `string`
interface ReplaceRouteParam extends Fn {
  return: this['arg0'] extends `:${string}` ? string : this['arg0'];
}
// path is user-side, so `:xxx` for them is any `string`
type Pathname<Route extends RawRoute> = `/${Pipe<
  Route,
  [Strings.Split<'/'>, Tuples.Map<ReplaceRouteParam>, Tuples.Join<'/'>]
>}${Route extends `${string}/` ? '/' : ''}`;
// @example
// type test = Pathname<'/user/:id/:name'>

// also, we should allow user to add query and hash
export type Path<Route extends RawRoute> =
  | Pathname<Route>
  | `${Pathname<Route>}?${string}`
  | `${Pathname<Route>}#${string}`;

// after defining a path, we should parse it for more complex usage
export type ParsedRoute<R extends RawRoute> = {
  keys: RouteParams<R>[];
  // build is a function, which can mix `Route` and `Params` to `Path`
  build(...params: PathConstructorParams<R>): Path<R>;
  raw: R;
  ambiguousness: number;
  pattern: RegExp;
};

// cannot use `type` because we need `this`
export interface RouteWithParams<R extends RawRoute> {
  route: ParsedRoute<R>;
  params: RouteParamsMap<R>;
  // if `route: ParsedRoute<T>` is the same as `this: RouteWithParams<T>`
  // then matches return `true`
  matches: <T extends RawRoute>(
    route: ParsedRoute<T>
  ) => this is RouteWithParams<T>;
}

// similar to `RawRoutesMap`, but its element is `ParsedRoute`
export type ParsedRoutesMap<RM extends RawRoutesMap> = {
  [Key in keyof RM]: RM[Key] extends RawRoute
    ? ParsedRoute<RM[Key]>
    : RM[Key] extends RawRoutesMap
    ? ParsedRoutesMap<RM[Key]>
    : never;
};

type FlattenRouteMap<T> = T extends ParsedRoute<RawRoute> | RawRoute
  ? T
  : T extends ParsedRoutesMap<RawRoutesMap> | RawRoutesMap
  ? AllRoutesFromMap<T>
  : never;
export type AllRoutesFromMap<
  RM extends ParsedRoutesMap<RawRoutesMap> | RawRoutesMap
> = FlattenRouteMap<Values<RM>>;
// ! if we directly nesting `FlattenRouteMap` like below
// ! in `internal.ts`, we will get a ts error: nesting may be infinite
// ! solution is to add another type and let them include each other
// type FlattenRouteMap<T> = T extends ParsedRoute<RawRoute> | RawRoute
//   ? T
//   : T extends ParsedRoutesMap<RawRoutesMap> | RawRoutesMap
//   ? FlattenRouteMap<Values<T>>
//   : never;
// export type AllRoutesFromMap<
//   RM extends ParsedRoutesMap<RawRoutesMap> | RawRoutesMap
// > = FlattenRouteMap<Values<RM>>;
