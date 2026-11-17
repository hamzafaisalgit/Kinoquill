import { BrowserRouter, Route, Routes } from "react-router-dom";
import { AppLayout } from "./components/layout/AppLayout";
import { Dashboard } from "./pages/Dashboard";
import {
  CollectionPage,
  AnalyticsPage,
  ImportExportPage,
  SettingsPage,
  NotFoundPage,
} from "./pages/Pages";
import { collectionRoutes } from "./lib/routes";
import "./App.css";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<AppLayout />}>
          <Route index element={<Dashboard />} />
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
