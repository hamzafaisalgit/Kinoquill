import { useEffect, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, Pencil, Plus, Star } from "lucide-react";
import type { DiscoveryMetadata, TitleDraft } from "../../services/tmdb/types";
import { PosterArtwork } from "./PosterArtwork";

export function MetadataPreview({
  details,
  checking,
  onUse,
  onBack,
  onManual,
}: {
  details: DiscoveryMetadata;
  checking: boolean;
  onUse: (draft: TitleDraft) => Promise<unknown>;
  onBack: () => void;
  onManual: (draft: TitleDraft) => void;
}) {
  const [peopleText, setPeopleText] = useState("");
  const heading = useRef<HTMLDivElement>(null);
  useEffect(() => {
    heading.current?.focus();
  }, []);
  const { metadata } = details;
  const isMovie = metadata.mediaType === "movie";
  const names = peopleText
    .split("\n")
    .map((name) => name.trim())
    .filter(Boolean);
  function asDraft(): TitleDraft {
    return {
      metadata,
      genres: details.genres,
      people: names.map((name) => ({
        name,
        role: isMovie ? "director" : "creator",
      })),
      source: "tmdb",
      preparedAt: new Date().toISOString(),
      confirmedPossibleDuplicate: false,
    };
  }
  return (
    <section
      className="panel metadata-preview"
      aria-labelledby="metadata-title"
    >
      {metadata.backdropPath && (
        <div className="metadata-backdrop">
          <PosterArtwork
            path={metadata.backdropPath}
            title={metadata.title}
            size="w1280"
            backdrop
          />
        </div>
      )}
      <div className="preview-navigation">
        <button className="text-button" onClick={onBack}>
          <ArrowLeft size={15} />
          Back to results
        </button>
        <span className="outline-pill">TMDB METADATA · NOT SAVED</span>
      </div>
      <div className="metadata-preview-grid">
        <div className="preview-poster">
          <PosterArtwork
            path={metadata.posterPath}
            title={metadata.title}
            size="w500"
          />
          <a
            href={`https://www.themoviedb.org/${metadata.mediaType}/${metadata.tmdbId}`}
            target="_blank"
            rel="noreferrer"
          >
            View source on TMDB ↗
          </a>
        </div>
        <div className="preview-information" ref={heading} tabIndex={-1}>
          <p className="eyebrow">
            {isMovie ? "A FILM TO DISCOVER" : "A STORY IN CHAPTERS"}
          </p>
          <h2 id="metadata-title">{metadata.title}</h2>
          <div className="metadata-line">
            <span>{metadata.releaseYear ?? "Year unknown"}</span>
            <span>
              {isMovie
                ? "Movie"
                : metadata.mediaSubtype === "tv_miniseries"
                  ? "TV miniseries"
                  : "TV show"}
            </span>
            <span>
              {metadata.runtimeMinutes
                ? `${metadata.runtimeMinutes} min${isMovie ? "" : " typical episode"}`
                : "Runtime unknown"}
            </span>
          </div>
          <div className="metadata-genres">
            {details.genres.length ? (
              details.genres.map((genre) => (
                <span className="outline-pill" key={genre}>
                  {genre}
                </span>
              ))
            ) : (
              <span className="muted-label">Genres unavailable</span>
            )}
          </div>
          <p className="metadata-overview">
            {metadata.overview || "No overview is available for this title."}
          </p>
          <dl className="metadata-facts">
            <div>
              <dt>{isMovie ? "Release date" : "First air date"}</dt>
              <dd>{metadata.releaseDate || "Unknown"}</dd>
            </div>
            <div>
              <dt>Original language</dt>
              <dd>{metadata.originalLanguage || "Unknown"}</dd>
            </div>
            <div>
              <dt>Production countries</dt>
              <dd>{metadata.countries?.join(", ") || "Unknown"}</dd>
            </div>
            {!isMovie && (
              <>
                <div>
                  <dt>Available episodes</dt>
                  <dd>
                    {details.episodeCount ?? "Unknown"} ·{" "}
                    {details.seasonCount ?? "Unknown"} seasons
                  </dd>
                </div>
                <div>
                  <dt>Production status</dt>
                  <dd>
                    {details.productionStatus || "Unknown"} · separate from your
                    watch status
                  </dd>
                </div>
                <div>
                  <dt>Last air date</dt>
                  <dd>{details.lastAirDate || "Unknown"}</dd>
                </div>
              </>
            )}
            {details.communityRating !== null && (
              <div>
                <dt>
                  <Star size={12} />
                  TMDB community rating
                </dt>
                <dd>
                  {details.communityRating.toFixed(1)}/10 · not your personal
                  rating
                </dd>
              </div>
            )}
          </dl>
          <section className="people-suggestions">
            <h3>{isMovie ? "Director suggestions" : "Creator suggestions"}</h3>
            <p>
              Choose any suggestions you want to keep, edit them, or leave this
              blank. Existing local people are never overwritten.
            </p>
            <div className="suggestion-buttons">
              {details.suggestions.length ? (
                details.suggestions.map((person, index) => (
                  <button
                    className="secondary-button"
                    key={`${person.name}:${index}`}
                    disabled={names.includes(person.name)}
                    onClick={() =>
                      setPeopleText([...names, person.name].join("\n"))
                    }
                  >
                    <Plus size={13} />
                    {person.name}
                  </button>
                ))
              ) : (
                <span className="preference-note">
                  No suggestions available. You can enter names below.
                </span>
              )}
            </div>
            <label className="field-label">
              Your chosen {isMovie ? "directors" : "creators"}
              <textarea
                rows={2}
                value={peopleText}
                onChange={(event) => setPeopleText(event.target.value)}
                placeholder="Optional · one name per line"
              />
            </label>
          </section>
        </div>
      </div>
      {!isMovie && details.seasons.length > 0 && (
        <details className="season-summaries">
          <summary>
            Available season summaries{" "}
            <span>{details.seasons.length} catalogued</span>
          </summary>
          <div>
            {details.seasons.map((season) => (
              <article key={season.number}>
                <strong>{season.name}</strong>
                <p>
                  Season {season.number} · {season.episodeCount ?? "Unknown"}{" "}
                  episodes · {season.airDate || "Air date unknown"}
                </p>
              </article>
            ))}
          </div>
        </details>
      )}
      <div className="preview-actions">
        <p>
          Next: prepare editable metadata. Nothing is added to your library yet.
        </p>
        <button
          className="secondary-button"
          onClick={() => onManual(asDraft())}
        >
          <Pencil size={14} />
          Enter manually
        </button>
        <button
          className="button"
          disabled={checking}
          onClick={() => void onUse(asDraft())}
        >
          {checking ? "Checking local matches…" : "Use this title"}
          <ArrowRight size={15} />
        </button>
      </div>
    </section>
  );
}
