import {
  inject,
  parse,
  type RouteParams as RegexRouteParams,
} from 'regexparam';
import {
  RawRoutesMap,
  ParsedRoutesMap,
  RawRoute,
  ParsedRoute,
  RouteParams,
  RouteParamsMap,
  SearchAndHash,
  Path,
  AllRoutesFromMap,
  RouteWithParams,
} from './internal.type';
import { typedKeys } from './utils';
import { StringLike } from './utils.type';

export const defineRoutes = <T extends RawRoutesMap>(
  routesMap: T
): ParsedRoutesMap<T> => {
  const entries = typedKeys(routesMap).map((key) => {
    const routeOrMap = routesMap[key];
    if (typeof routeOrMap === 'string') {
      return [key, parseRoute(routeOrMap)];
    } else {
      return [key, defineRoutes(routeOrMap)];
    }
  });

  return Object.fromEntries(entries);
};

const parseRoute = <R extends RawRoute>(route: R): ParsedRoute<R> => {
  if (!route.startsWith('/')) {
    throw new InvalidRoute(`route should start with slash: route=${route}`);
  }
  // extract `:xxx` from route
  const { keys, pattern } = parse(route);
  const hasRouteParams = keys.length > 0;
  const parsedRoute: ParsedRoute<R> = {
    build(...args) {
      // according to route has params or not, pick the right args
      const routeParamsMap = (hasRouteParams ? args[0] : undefined) as
        | RouteParamsMap<R, StringLike>
        | undefined;
      const searchAndHash = (hasRouteParams ? args[1] : args[0]) as
        | SearchAndHash
        | undefined;

      if (hasRouteParams) {
        // route has params, but got none
        if (!routeParamsMap) {
          throw new InvalidRouteParams(
            `route params not provided: route=${route}`
          );
        }
        // route has params, but not got all
        const missingRouteParams = keys.filter((k) => !(k in routeParamsMap));
        if (missingRouteParams.length) {
          throw new InvalidRouteParams(
            `missing route params: route=${route} missing=${missingRouteParams.join(
              ','
            )}`
          );
        }
      }

      // fill route params into `:xxx`
      let path = hasRouteParams
        ? inject(route, routeParamsMap as RegexRouteParams<R>)
        : route;

      // query: support string(with `?` or not) and object format
      if (searchAndHash && searchAndHash.search) {
        if (typeof searchAndHash.search === 'string') {
          path += searchAndHash.search.startsWith('?')
            ? searchAndHash.search
            : '?' + searchAndHash.search;
        } else {
          path += '?' + new URLSearchParams(searchAndHash.search).toString();
        }
      }

      // hash: support string with `#` or not
      if (searchAndHash && searchAndHash.hash) {
        path += searchAndHash.hash.startsWith('#')
          ? searchAndHash.hash
          : '#' + searchAndHash.hash;
      }

      return path as Path<R>;
    },
    raw: route,
    keys: (keys as RouteParams<R>[]) || [],
    ambiguousness: keys.length,
    pattern,
  };

  return parsedRoute;
};

export class InvalidRoute extends Error {}
export class InvalidRouteParams extends Error {}

// judge whether an object is `ParsedRoute`
export const isParsedRoute = <T extends `/${string}` = `/${string}`>(
  route: unknown
): route is ParsedRoute<T> => {
  return (
    !!route &&
    typeof route === 'object' &&
    'raw' in route &&
    typeof route.raw === 'string' &&
    'build' in route &&
    typeof route.build === 'function'
  );
};

// transform a nesting `ParsedRoutesMap` to a flat array
export const getAllRoutes = <T extends RawRoutesMap>(
  parsedRoutesMap: ParsedRoutesMap<T>
): ParsedRoute<AllRoutesFromMap<T>>[] => {
  type PossibleRawRoute = AllRoutesFromMap<T>;
  return typedKeys(parsedRoutesMap).flatMap((k) => {
    const parsedRouteOrParsedRoutesMap = parsedRoutesMap[k];
    if (isParsedRoute<PossibleRawRoute>(parsedRouteOrParsedRoutesMap)) {
      return [parsedRouteOrParsedRoutesMap] as const;
    }
    return getAllRoutes(parsedRouteOrParsedRoutesMap as ParsedRoutesMap<T>);
  });
};

export const areRoutesEqual = <A extends RawRoute, B extends RawRoute>(
  a: RouteWithParams<A> | undefined,
  b: RouteWithParams<B> | undefined
): boolean => {
  if (!a && !b) return true; // both undefined
  if ((!a && b) || (a && !b)) return false; // only one undefined
  if (!a!.matches(b!.route)) return false; // different routes
  // judge all params
  const allParamsMatch = a.route.keys.every(
    (key) => a.params[key] === b!.params[key]
  );
  return allParamsMatch;
};
