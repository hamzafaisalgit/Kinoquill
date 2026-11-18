import { journalPreferences } from "../../services/preferences";
import "../../styles/personal.css";
import { Suspense, useEffect, useRef, useState } from "react";
import { Link, NavLink, Outlet, useLocation } from "react-router-dom";
import {
  ArrowLeftToLine,
  ArrowRightFromLine,
  Menu,
  Plus,
  Search,
  X,
} from "lucide-react";
import { navigation, pageLabel } from "../../lib/routes";
import { LocalStorageStatus } from "../common/LocalStorageStatus";
import { ErrorState, LoadingState } from "../common/States";
import { useLocalStorage } from "../../hooks/useLocalStorage";

function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <NavLink className="brand" to="/" aria-label="Kinoquill home">
      <span className="brand-mark" aria-hidden="true">
        <svg viewBox="0 0 32 32" fill="none">
          <path
            d="M8 7v18m2-9L23 7M10 16l13 9m3-23-4 9-3-3z"
            stroke="currentColor"
            strokeWidth="1.7"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </span>
      {!compact && (
        <span>
          Kino<span className="accent">quill</span>
          <small>YOUR PERSONAL CINEMA</small>
        </span>
      )}
    </NavLink>
  );
}

function Navigation({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <nav aria-label="Main navigation">
      {navigation.map(({ path, label, icon: Icon }) => (
        <div
          key={path}
          className={
            path === "/analytics" || path === "/settings"
              ? "nav-separator"
              : undefined
          }
        >
          <NavLink
            to={path}
            end={path === "/"}
            onClick={onNavigate}
            className={({ isActive }) => `nav-link ${isActive ? "active" : ""}`}
            title={label}
          >
            <Icon size={19} strokeWidth={1.7} />
            <span>{label}</span>
          </NavLink>
        </div>
      ))}
    </nav>
  );
}

export function Sidebar({
  collapsed,
  onToggle,
  disabled,
}: {
  collapsed: boolean;
  onToggle: () => void;
  disabled: boolean;
}) {
  return (
    <aside className={`sidebar ${collapsed ? "collapsed" : ""}`}>
      <Brand compact={collapsed} />
      <p className="nav-caption">YOUR SPACE</p>
      <Navigation />
      <div className="sidebar-bottom">
        <div className="local-note">
          <span className="local-symbol">K</span>
          <div>
            <strong>A collection that’s yours.</strong>
            <p>Personal. Local. Curated.</p>
          </div>
        </div>
        <button
          className="collapse-button"
          onClick={onToggle}
          disabled={disabled}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {collapsed ? (
            <ArrowRightFromLine size={17} />
          ) : (
            <>
              <ArrowLeftToLine size={17} />
              <span>Collapse sidebar</span>
            </>
          )}
        </button>
      </div>
    </aside>
  );
}

export function MobileNavigation({ onClose }: { onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const element = dialog.current;
    element?.showModal();
    return () => element?.close();
  }, []);
  return (
    <dialog
      ref={dialog}
      className="mobile-navigation"
      onCancel={onClose}
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="drawer-header">
        <Brand />
        <button
          autoFocus
          className="icon-button"
          onClick={onClose}
          aria-label="Close navigation"
        >
          <X size={22} />
        </button>
      </div>
      <Navigation onNavigate={onClose} />
      <p className="drawer-note">YOUR PERSONAL CINEMA · CHAPTER 03</p>
    </dialog>
  );
}

export function Topbar({ onMenu }: { onMenu: () => void }) {
  const location = useLocation();
  const page = pageLabel(location.pathname);
  return (
    <header className="topbar">
      <div className="topbar-title">
        <button
          className="icon-button mobile-menu"
          onClick={onMenu}
          aria-label="Open navigation"
        >
          <Menu size={22} />
        </button>
        <span className="breadcrumb-brand">
          Workspace <span>/</span>
        </span>
        <strong>{page}</strong>
      </div>
      <div className="topbar-actions">
        <Link
          className="search-affordance"
          to="/library?focus=search"
          aria-label="Search my library locally"
        >
          <Search size={16} />
          <span>Search my library</span>
          <kbd>LOCAL</kbd>
        </Link>
        <Link className="text-link topbar-discover" to="/discover">
          Discover <small>TMDB</small>
        </Link>
        <LocalStorageStatus />
        <Link
          className="button discover-topbar-button"
          to={
            location.pathname.startsWith("/shows")
              ? "/shows/new"
              : location.pathname.startsWith("/movies")
                ? "/movies/new"
                : "/library?add=1"
          }
        >
          <Plus size={15} />
          {location.pathname.startsWith("/shows")
            ? "Add TV show"
            : location.pathname.startsWith("/movies")
              ? "Add movie"
              : "Add title"}
        </Link>
      </div>
    </header>
  );
}

export function AppLayout() {
  const storage = useLocalStorage();
  const collapsed = storage.settings.sidebarCollapsed;
  const [mobileOpen, setMobileOpen] = useState(false);
  const { pathname } = useLocation();
  const main = useRef<HTMLElement>(null);
  const previousPath = useRef(pathname);
  useEffect(() => {
    document.title = `${pageLabel(pathname)} · Kinoquill`;
    if (previousPath.current !== pathname) {
      main.current?.focus();
      window.scrollTo(0, 0);
      previousPath.current = pathname;
    }
  }, [pathname]);
  return (
    <div
      className={`app-layout ${collapsed ? "is-collapsed" : ""} ${journalPreferences(storage.settings.journal).reducedMotion ? "prefers-reduced-motion" : ""}`}
    >
      <a className="skip-link" href="#main-content">
        Skip to content
      </a>
      <Sidebar
        collapsed={collapsed}
        onToggle={() =>
          void storage.updateSettings({ sidebarCollapsed: !collapsed })
        }
        disabled={storage.phase !== "ready" || storage.saving}
      />
      <div className="workspace">
        <Topbar onMenu={() => setMobileOpen(true)} />
        <main id="main-content" ref={main} tabIndex={-1}>
          {storage.error && (
            <ErrorState
              message={storage.error}
              onRetry={() => void storage.retry()}
            />
          )}
          <Suspense
            fallback={<LoadingState message="Opening your local cinema…" />}
          >
            <Outlet />
          </Suspense>
        </main>
        <footer className="app-footer">
          <span>
            Kinoquill <span className="footer-dot">·</span> A little more cinema
            in your life.
          </span>
          <span>
            FOUNDATION EDITION <span className="footer-dot">/</span> v0.1.0
          </span>
        </footer>
      </div>
      {mobileOpen && <MobileNavigation onClose={() => setMobileOpen(false)} />}
    </div>
  );
}
