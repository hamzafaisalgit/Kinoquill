import { BrowserRouter, Route, Routes } from "react-router-dom";
import { lazy, Suspense } from "react";
import { AppLayout } from "./components/layout/AppLayout";
import { LoadingState } from "./components/common/States";
import {
  CollectionPage,
  AnalyticsPage,
  ImportExportPage,
  SettingsPage,
  NotFoundPage,
} from "./pages/Pages";
import { collectionRoutes } from "./lib/routes";
import "./App.css";

const Dashboard = lazy(() =>
  import("./pages/Dashboard").then((module) => ({ default: module.Dashboard })),
);

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
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
          {collectionRoutes.map((route) => (
            <Route
              key={route.path}
              path={route.path}
              element={<CollectionPage route={route} />}
            />
          ))}
          <Route path="analytics" element={<AnalyticsPage />} />
          <Route path="import-export" element={<ImportExportPage />} />
          <Route path="settings" element={<SettingsPage />} />
          <Route path="*" element={<NotFoundPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
