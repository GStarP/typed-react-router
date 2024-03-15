import { AppRouter, AppRoutes } from './route';

AppRouter.addBlocker(() => {
  return !confirm(
    `are you sure to leave ${AppRouter.getCurrentRoute()?.route.raw} ?`
  );
});

export default function App() {
  const location = AppRouter.useLocation();
  const curRoute = AppRouter.useCurrentRoute();
  return (
    <div>
      <div>
        <AppRouter.Link href={AppRoutes.home.build({})}>Home</AppRouter.Link>
        <AppRouter.Link
          href={AppRoutes.about.build({
            search: {
              company: (Math.random() * 1000).toFixed(0),
            },
          })}
        >
          About
        </AppRouter.Link>
        <AppRouter.Link
          href={AppRoutes.user.build({
            id: (Math.random() * 1000).toFixed(0),
          })}
        >
          User
        </AppRouter.Link>
      </div>
      <div>
        <div>Location: {JSON.stringify(location)}</div>
        <br></br>
        <div>Current Route: {JSON.stringify(curRoute)}</div>
        <br></br>

        <AppRouter.Route match={AppRoutes.home} component={Home} />
        <AppRouter.Route match={AppRoutes.about} component={About} />
        <AppRouter.Route match={AppRoutes.user} component={User} />
        <AppRouter.NotFound component={NotFound} />
      </div>
    </div>
  );
}

function Home() {
  return <div>Home</div>;
}

function About() {
  const searchParams = AppRouter.useSearchParams();
  return <div>About: {searchParams['company']}</div>;
}

function User() {
  const { params } = AppRouter.useRoute(AppRoutes.user);
  return <div>User: {params.id}</div>;
}

function NotFound() {
  return <div>404</div>;
}
