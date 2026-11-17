import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { useContinueWatching } from "../../hooks/useCatalog";
import { PosterArtwork } from "../discovery/PosterArtwork";
export function ContinueWatching() {
  const result = useContinueWatching();
  if (result.isLoading)
    return <p className="preference-note">Reading Continue Watching…</p>;
  if (result.error)
    return (
      <p className="field-error">Continue Watching could not be loaded.</p>
    );
  if (!result.data?.length) return null;
  return (
    <section className="tv-continue-section">
      <div className="section-label">
        <h2>Continue Watching</h2>
        <span>Your next chapter</span>
      </div>
      <div className="tv-continue-grid">
        {result.data.map((record) => {
          const next = record.summary.next,
            season = next
              ? record.seasons.find((item) => item.id === next.seasonId)
              : null;
          const href = `/shows/${record.title.id}${season ? `#season-${season.id}` : "#seasons"}`;
          return (
            <Link
              className="panel tv-continue-card"
              key={record.title.id}
              to={href}
            >
              <PosterArtwork
                path={record.title.posterPath}
                title={record.title.title}
                allowExternal
              />
              <div>
                <strong>{record.title.title}</strong>
                <p>
                  {record.summary.approximate ? "Approximate · " : ""}
                  {record.summary.watched} / {record.summary.total ?? "?"}{" "}
                  episodes recorded
                </p>
                <span>
                  {next && season
                    ? `Next · S${season.seasonNumber} E${next.episodeNumber} · ${next.name ?? "Untitled"}`
                    : "Continue tracking"}
                  <ArrowRight size={13} />
                </span>
              </div>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
