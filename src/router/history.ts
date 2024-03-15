export type HistoryLocation = Pick<
  Location,
  'href' | 'hash' | 'search' | 'pathname'
> & {
  origin: string;
};

export type NavigationBlocker = (flag: boolean) => boolean;

export const createHistory = () => {
  const winHistory = window.history;
  const winLocation = window.location;

  // ? `useSyncExternalStorage` ask us to return fixed reference to avoid infinite rerender
  // ? but I thinks there is a better way to handle that
  const location: HistoryLocation = {
    origin: winLocation.origin,
    href: winLocation.href,
    hash: winLocation.hash,
    search: winLocation.search,
    pathname: winLocation.pathname,
  };
  const getLocation = (): HistoryLocation => {
    location.origin = winLocation.origin;
    location.href = winLocation.href;
    location.hash = winLocation.hash;
    location.search = winLocation.search;
    location.pathname = winLocation.pathname;
    return location;
  };
  // blocker related
  let blockers: NavigationBlocker[] = [];

  const tryNavigate = (cb: VoidFunction) => {
    const blocked = blockers.some((blocker) => blocker(true));
    if (blocked) return;
    cb();
  };

  const beforeUnloadHandler = (event: Event) => {
    const blocked = blockers.some((blocker) => blocker(false));
    if (blocked) {
      event.preventDefault();
      return '';
    }
  };
  const addBlocker = (blocker: NavigationBlocker) => {
    blockers.push(blocker);
    if (blockers.length === 1) {
      addEventListener('beforeunload', beforeUnloadHandler, {
        capture: true,
      });
    }
    return () => {
      blockers = blockers.filter((b) => b !== blocker);
      if (blockers.length === 0) {
        removeEventListener('beforeunload', beforeUnloadHandler, {
          capture: true,
        });
      }
    };
  };

  // get full control of history change
  const subscribers: Set<VoidFunction> = new Set();
  const subscribePopState = (cb: VoidFunction) => {
    subscribers.add(cb);
    return () => subscribers.delete(cb);
  };
  const triggerCallbacks = () => {
    console.log('popstate');
    subscribers.forEach((fn) => {
      try {
        fn();
      } catch (err) {
        console.error('callback error on route change:', err);
      }
    });
  };
  addEventListener('popstate', triggerCallbacks);

  // proxy pushState and replaceState so we can make our blocker
  // prior to browser default behavior
  const rawPushState = winHistory.pushState.bind(winHistory);
  const rawReplaceState = winHistory.replaceState.bind(winHistory);
  winHistory.pushState = (...args) => {
    tryNavigate(() => {
      rawPushState(...args);
      triggerCallbacks();
    });
  };
  winHistory.replaceState = (...args) => {
    tryNavigate(() => {
      rawReplaceState(...args);
      triggerCallbacks();
    });
  };

  return {
    // external api
    subscribePopState,
    getLocation,
    addBlocker,
    // proxy function
    push: winHistory.pushState,
    replace: winHistory.replaceState,
    go: (distance: number) =>
      tryNavigate(() => winHistory.go.call(winHistory, distance)),
    back: () => tryNavigate(() => winHistory.back.call(winHistory)),
    forward: () => tryNavigate(() => winHistory.forward.call(winHistory)),
  };
};
