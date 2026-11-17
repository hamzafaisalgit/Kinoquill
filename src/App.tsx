import {
  createBrowserRouter,
  createRoutesFromElements,
  Route,
  RouterProvider,
} from "react-router-dom";
import { Toaster } from "sonner";
import { lazy, Suspense } from "react";
import { AppLayout } from "./components/layout/AppLayout";
import { LoadingState } from "./components/common/States";
import { collectionRoutes } from "./lib/routes";
import "./App.css";

const Dashboard = lazy(() =>
  import("./pages/Dashboard").then((module) => ({ default: module.Dashboard })),
);
const CollectionPage = lazy(() =>
  import("./pages/Pages").then((module) => ({
    default: module.CollectionPage,
  })),
);
const AnalyticsPage = lazy(() =>
  import("./pages/Pages").then((module) => ({ default: module.AnalyticsPage })),
);
const ImportExportPage = lazy(() =>
  import("./pages/Pages").then((module) => ({
    default: module.ImportExportPage,
  })),
);
const SettingsPage = lazy(() =>
  import("./pages/Pages").then((module) => ({ default: module.SettingsPage })),
);
const NotFoundPage = lazy(() =>
  import("./pages/Pages").then((module) => ({ default: module.NotFoundPage })),
);
const DiscoverPage = lazy(() => import("./pages/DiscoverPage"));
const TitleDraftPage = lazy(() => import("./pages/TitleDraftPage"));
const MoviesPage = lazy(() => import("./pages/MoviesPage"));
const MovieEditorPage = lazy(() => import("./pages/MovieEditorPage"));
const MovieDetailsPage = lazy(() => import("./pages/MovieDetailsPage"));
const MovieCollection = lazy(() =>
  import("./pages/MoviesPage").then((module) => ({
    default: module.MovieCollection,
  })),
);

const router = createBrowserRouter(
  createRoutesFromElements(
    <Route element={<AppLayout />}>
      <Route
        index
        element={
          <Suspense
            fallback={<LoadingState message="Loading your local cinema…" />}
          >
            <Dashboard />
          </Suspense>
        }
      />
      {collectionRoutes
        .filter(
          (route) =>
            !["/movies", "/watchlist", "/favorites"].includes(route.path),
        )
        .map((route) => (
          <Route
            key={route.path}
            path={route.path}
            element={<CollectionPage route={route} />}
          />
        ))}
      <Route
        path="movies"
        element={
          <Suspense fallback={<LoadingState />}>
            <MoviesPage />
          </Suspense>
        }
      />
      <Route
        path="movies/new"
        element={
          <Suspense fallback={<LoadingState />}>
            <MovieEditorPage />
          </Suspense>
        }
      />
      <Route
        path="movies/:id/edit"
        element={
          <Suspense fallback={<LoadingState />}>
            <MovieEditorPage />
          </Suspense>
        }
      />
      <Route
        path="movies/:id"
        element={
          <Suspense fallback={<LoadingState />}>
            <MovieDetailsPage />
          </Suspense>
        }
      />
      <Route
        path="watchlist"
        element={
          <Suspense fallback={<LoadingState />}>
            <MovieCollection kind="watchlist" />
          </Suspense>
        }
      />
      <Route
        path="favorites"
        element={
          <Suspense fallback={<LoadingState />}>
            <MovieCollection kind="favorites" />
          </Suspense>
        }
      />
      <Route path="analytics" element={<AnalyticsPage />} />
      <Route path="import-export" element={<ImportExportPage />} />
      <Route path="settings" element={<SettingsPage />} />
      <Route
        path="discover"
        element={
          <Suspense fallback={<LoadingState message="Opening discovery…" />}>
            <DiscoverPage />
          </Suspense>
        }
      />
      <Route
        path="draft"
        element={
          <Suspense
            fallback={<LoadingState message="Opening your prepared draft…" />}
          >
            <TitleDraftPage />
          </Suspense>
        }
      />
      <Route path="*" element={<NotFoundPage />} />
    </Route>,
  ),
);
export default function App() {
  return (
    <>
      <RouterProvider router={router} />
      <Toaster
        theme="dark"
        position="bottom-right"
        closeButton
        toastOptions={{
          style: {
            background: "#191e2a",
            borderColor: "#343c49",
            color: "#f3f5f8",
          },
        }}
      />
    </>
  );
}
