import { HistoryLocation, NavigationBlocker, createHistory } from './history';
import { getAllRoutes, isParsedRoute, areRoutesEqual } from './internal';
import {
  RawRoutesMap,
  ParsedRoutesMap,
  AllRoutesFromMap,
  RouteWithParams,
  ParsedRoute,
  RawRoute,
  RouteParamsMap,
  Path,
} from './internal.type';
import { filterOutFalsy } from './utils';
import {
  ComponentProps,
  ComponentType,
  MouseEventHandler,
  useEffect,
  useMemo,
  useSyncExternalStore,
} from 'react';

export const createRouter = <T extends RawRoutesMap>(
  routesMap: ParsedRoutesMap<T>
) => {
  type RouteType = AllRoutesFromMap<T>;
  type BindedRouteWithParams = RouteWithParams<RouteType>;
  type RouteFilter<T extends RouteType> =
    | ParsedRoute<T>
    | ParsedRoute<T>[]
    | Record<string, ParsedRoute<T>>;

  const history = createHistory();
  const routes = getAllRoutes(routesMap);

  // use `Path` to match `Route` and get `RouteParamsMap`
  const extractRouteParams = <T extends RawRoute>(
    pathname: string,
    parsedRoute: ParsedRoute<T>
  ) => {
    const match = parsedRoute.pattern.exec(pathname);
    if (!match) return undefined;
    // match[0] is path, others are params
    return Object.fromEntries(
      parsedRoute.keys.map((key, index) => {
        return [key, match[index + 1]];
      })
    ) as RouteParamsMap<T>;
  };

  const findMatchingRoute = (
    location: HistoryLocation
  ): BindedRouteWithParams | undefined => {
    const matchingRoutes = filterOutFalsy(
      routes.map((route) => {
        const params = extractRouteParams<RawRoute>(location.pathname, route);
        if (!params) return undefined;
        return {
          route,
          params,
          matches<T extends RawRoute>(r: ParsedRoute<T>) {
            return route === r;
          },
        };
      })
    );

    // none match and exact match
    if (matchingRoutes.length === 0) return undefined;
    if (matchingRoutes.length === 1) return matchingRoutes[0];

    // if multiple matches, choose the most suitable one
    let lowestAmbiguousnessLevel = Infinity;
    let lowestAmbiguousnessMatches: BindedRouteWithParams[] = [];
    matchingRoutes.forEach((match) => {
      // remember? ambiguousness is route params length
      // so as below, less params, more priority
      // @example `/user/list` > `/user/:id`
      if (match.route.ambiguousness === lowestAmbiguousnessLevel) {
        lowestAmbiguousnessMatches.push(match);
      } else if (match.route.ambiguousness < lowestAmbiguousnessLevel) {
        lowestAmbiguousnessLevel = match.route.ambiguousness;
        lowestAmbiguousnessMatches = [match];
      }
    });
    if (lowestAmbiguousnessMatches.length !== 1) {
      throw new RouteMatchingConflict(
        `Multiple routes with same ambiguousness level matched pathname ${
          location.pathname
        }: ${lowestAmbiguousnessMatches.map((m) => m.route.raw).join(', ')}`
      );
    }

    return lowestAmbiguousnessMatches[0];
  };

  let currentRoute = findMatchingRoute(history.getLocation());
  const getCurrentRoute = () => currentRoute;

  // subscribe to history popstate
  const subscribers: Set<VoidFunction> = new Set();
  const subscribeRouteChange = (cb: VoidFunction) => {
    subscribers.add(cb);
    return () => subscribers.delete(cb);
  };
  const triggerCallbacks = () => {
    subscribers.forEach((cb) => {
      try {
        cb();
      } catch (err) {
        console.error('Error in route change subscriber', err);
      }
    });
  };
  history.subscribePopState(() => {
    const newRoute = findMatchingRoute(history.getLocation());
    if (!areRoutesEqual(newRoute, currentRoute)) {
      currentRoute = newRoute;
      triggerCallbacks();
    }
  });

  // unsafe navigate: recv any string
  const unsafeNavigate = (
    path: string,
    { action = 'push' }: { action?: 'push' | 'replace' } = {}
  ) => {
    history[action]({}, '', path);
  };
  // safe navigate: only recv registered routes
  const navigate = (
    path: Path<RouteType>,
    options: { action?: 'push' | 'replace' } = {}
  ) => {
    unsafeNavigate(path, options);
  };

  /**
   * Hooks
   */
  const useLocation = () => {
    return useSyncExternalStore(history.subscribePopState, history.getLocation);
  };
  const useCurrentRoute = () => {
    return useSyncExternalStore(subscribeRouteChange, getCurrentRoute);
  };

  // define 3 types for 1 function
  function useRoute<T extends RouteType>(
    filter: RouteFilter<T>,
    strict?: true
  ): RouteWithParams<T>;
  function useRoute<T extends RouteType>(
    filter: RouteFilter<T>,
    strict: false
  ): RouteWithParams<T> | undefined;
  function useRoute<T extends RouteType>(
    filter: RouteFilter<T>,
    strict?: boolean
  ): RouteWithParams<T> | undefined {
    const currentRoute = useCurrentRoute();
    // ensure a route array
    const normalizedFilter = Array.isArray(filter)
      ? filter
      : isParsedRoute(filter)
      ? [filter]
      : Object.values(filter);

    const isMatching =
      !!currentRoute &&
      normalizedFilter.some((route) => currentRoute.matches(route));
    if (isMatching) return currentRoute as RouteWithParams<T>;
    else {
      // if not strict, return `undefined`, otherwise raise error
      if (strict === false) return undefined;
      throw new RouteMismatch(`Current route doesn't match provided filter(s)`);
    }
  }

  const useSearchParams = () => {
    const location = useLocation();
    return useMemo(() => {
      return Object.fromEntries(new URLSearchParams(location.search).entries());
    }, [location.search]);
  };

  const useNavigationBlocker = (cb: NavigationBlocker) => {
    useEffect(() => {
      return history.addBlocker(cb);
    }, [cb]);
  };

  /**
   * Components
   */
  type RouteProps = { component: ComponentType; match: RouteFilter<RouteType> };
  const Route = ({ component: Component, match }: RouteProps) => {
    const matchedRoute = useRoute(match, false);
    if (!matchedRoute) return null;
    return <Component />;
  };

  type NotFoundProps = { component: ComponentType };
  const NotFound = ({ component: Component }: NotFoundProps) => {
    const currentRoute = useCurrentRoute();
    if (currentRoute) return null;
    return <Component />;
  };

  type LinkProps = Omit<ComponentProps<'a'>, 'href'> & {
    href: Path<RouteType>;
  } & { action?: 'push' | 'replace' };

  const Link = ({ action = 'push', onClick, href, ...props }: LinkProps) => {
    const targetsCurrentTab = props.target !== '_blank';

    const localOnClick: MouseEventHandler<HTMLAnchorElement> = (event) => {
      if (onClick) {
        onClick(event);
        if (event.isDefaultPrevented()) {
          return;
        }
      }

      const inNewTab =
        !targetsCurrentTab ||
        event.ctrlKey ||
        event.shiftKey ||
        event.metaKey ||
        event.button === 1;

      if (!inNewTab) {
        event.preventDefault();
        navigate(href, { action });
      }
    };

    return <a {...props} href={href} onClick={localOnClick} />;
  };

  return {
    // imperative api
    go: history.go,
    back: history.back,
    forward: history.forward,
    addBlocker: history.addBlocker,
    getLocation: history.getLocation,
    subscribePopstate: history.subscribePopState,
    getCurrentRoute,
    subscribeRouteChange,
    unsafeNavigate,
    navigate,
    // hooks api
    useLocation,
    useCurrentRoute,
    useRoute,
    useSearchParams,
    useNavigationBlocker,
    // Components
    Link,
    NotFound,
    Route,
  };
};

export class RouteMatchingConflict extends Error {}
export class RouteMismatch extends Error {}
