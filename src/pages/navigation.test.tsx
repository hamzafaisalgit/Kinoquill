import { describe, expect, it, vi } from "vitest";
import { renderToString } from "react-dom/server";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { navigation, collectionRoutes } from "../lib/routes";
import { Dashboard } from "./Dashboard";
import MoviesPage, { MovieCollection } from "./MoviesPage";
import ShowsPage from "./ShowsPage";
import LibraryPage from "./LibraryPage";
import {
  AnalyticsPage,
  CollectionPage,
  ImportExportPage,
  SettingsPage,
  NotFoundPage,
} from "./Pages";

describe("frontend-only navigation", () => {
  const pages = [
    <Dashboard />,
    ...collectionRoutes.map((route) =>
      route.path === "/library" ? (
        <LibraryPage />
      ) : route.path === "/movies" ? (
        <MoviesPage />
      ) : route.path === "/shows" ? (
        <ShowsPage />
      ) : route.path === "/favorites" ? (
        <MovieCollection kind="favorites" />
      ) : route.path === "/watchlist" ? (
        <MovieCollection kind="watchlist" />
      ) : (
        <CollectionPage route={route} />
      ),
    ),
    <AnalyticsPage />,
    <ImportExportPage />,
    <SettingsPage />,
  ];

  it.each(navigation.map((route, index) => ({ ...route, page: pages[index] })))(
    "renders $path without any network request",
    ({ path, page }) => {
      const fetchSpy = vi.spyOn(globalThis, "fetch");
      try {
        const html = renderToString(
          <MemoryRouter initialEntries={[path]}>
            <Routes>
              <Route path={path} element={page} />
            </Routes>
          </MemoryRouter>,
        );
        expect(html).toContain("<h1>");
        expect(html).not.toMatch(
          /localhost:8000|api\/health|FastAPI|Backend connection/,
        );
        expect(fetchSpy).not.toHaveBeenCalled();
      } finally {
        fetchSpy.mockRestore();
      }
    },
  );

  it("renders a recovery link for unknown routes", () => {
    const html = renderToString(
      <MemoryRouter>
        <NotFoundPage />
      </MemoryRouter>,
    );
    expect(html).toContain("404");
    expect(html).toContain('href="/"');
  });
});
