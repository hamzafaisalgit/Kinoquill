import { ArrowLeft, ArrowUpRight, ShieldCheck } from "lucide-react";
import { Link } from "react-router-dom";
import {
  EmptyState,
  PageHeader,
  UpcomingButton,
} from "../components/common/States";
import type { CollectionRoute } from "../lib/routes";
import "../styles/discovery.css";

export function CollectionPage({ route }: { route: CollectionRoute }) {
  return (
    <>
      <PageHeader
        eyebrow={route.eyebrow}
        title={route.label}
        description={route.description}
        action={
          route.path === "/movies" || route.path === "/shows" ? (
            <Link
              className="button"
              to={`/discover?type=${route.path === "/shows" ? "tv" : "movie"}`}
            >
              Discover {route.path === "/shows" ? "shows" : "movies"}{" "}
              <ArrowUpRight size={15} />
            </Link>
          ) : (
            <UpcomingButton>{route.action}</UpcomingButton>
          )
        }
      />
      <section
        className={`panel library-scaffold ${route.path === "/favorites" ? "favorites-scaffold" : ""}`}
      >
        <div className="panel-header">
          <span className="section-overline">
            YOUR {route.label.toUpperCase()}
          </span>
          <span className="muted-label">Collection tools coming soon</span>
        </div>
        <EmptyState
          icon={route.icon}
          title={route.emptyTitle}
          description={route.emptyDescription}
        >
          <span className="outline-pill">
            Your personal collection, beautifully organized
          </span>
        </EmptyState>
        <div className="scaffold-cards" aria-hidden="true">
          <span />
          <span />
          <span />
          <span />
          <span />
          <span />
        </div>
      </section>
      <div className="info-strip">
        <ShieldCheck size={18} />
        <p>Your taste. Your records. A collection kept locally, with care.</p>
      </div>
    </>
  );
}

export function NotFoundPage() {
  return (
    <div className="not-found">
      <p className="eyebrow">SCENE NOT FOUND</p>
      <span className="error-number">404</span>
      <h1>This scene didn’t make the cut.</h1>
      <p>The page you’re looking for isn’t in this collection.</p>
      <Link to="/" className="button">
        <ArrowLeft size={16} />
        Back to dashboard
      </Link>
    </div>
  );
}
