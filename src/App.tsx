import { createBrowserRouter, RouterProvider } from 'react-router';
import { Layout } from './components/Layout.tsx';
import { Home } from './pages/Home.tsx';
import { NotFound } from './pages/NotFound.tsx';
import { RouteError } from './pages/RouteError.tsx';

// Module pages and the playground (editor, compiler client) load on first visit.
const router = createBrowserRouter([
  {
    element: <Layout />,
    errorElement: <RouteError />,
    children: [
      {
        // A page that fails shows its error inside the frame, so navigation keeps working.
        errorElement: <RouteError />,
        children: [
          { index: true, element: <Home /> },
          { path: 'modules/:slug', lazy: async () => ({ Component: (await import('./pages/ModulePage.tsx')).ModulePage }) },
          { path: 'playground', lazy: async () => ({ Component: (await import('./pages/Playground.tsx')).Playground }) },
          { path: 'review', lazy: async () => ({ Component: (await import('./pages/ReviewPage.tsx')).ReviewPage }) },
          { path: 'catalog', lazy: async () => ({ Component: (await import('./pages/UbCatalogPage.tsx')).UbCatalogPage }) },
          { path: 'progress', lazy: async () => ({ Component: (await import('./pages/ProgressPage.tsx')).ProgressPage }) },
          { path: '*', element: <NotFound /> },
        ],
      },
    ],
  },
], { basename: import.meta.env.BASE_URL });

export function App() {
  return <RouterProvider router={router} />;
}
