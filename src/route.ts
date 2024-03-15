import { createRouter, defineRoutes } from './router';

export const AppRoutes = defineRoutes({
  home: '/',
  about: '/about',
  user: '/user/:id',
});

export const AppRouter = createRouter(AppRoutes);
