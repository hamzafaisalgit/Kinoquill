import { useEffect, useRef } from "react";
import { AlertTriangle, ArrowRight, X } from "lucide-react";
import type { DuplicateMatch } from "../../types/domain";
import { useLibrary } from "../../hooks/useCatalog";

function ExistingRecord({ match }: { match: DuplicateMatch }) {
  const library = useLibrary({ search: match.title.title, pageSize: 200 });
  const entry = library.data?.items.find(
    (item) => item.title.id === match.title.id,
  )?.entry;
  return (
    <details className="existing-record">
      <summary>
        {match.title.title}{" "}
        <span>
          {match.title.releaseYear ?? "Year unknown"} ·{" "}
          {match.strength === "strong" ? "External ID match" : "Possible match"}
        </span>
      </summary>
      <dl>
        <div>
          <dt>Media type</dt>
          <dd>{match.title.mediaType === "movie" ? "Movie" : "TV show"}</dd>
        </div>
        <div>
          <dt>Local title ID</dt>
          <dd>{match.title.id}</dd>
        </div>
        <div>
          <dt>Personal library</dt>
          <dd>
            {library.isLoading
              ? "Reading local information…"
              : library.error
                ? "Personal data could not be loaded."
                : entry
                  ? `${entry.status.replaceAll("_", " ")} · ${entry.personalRating === null ? "Unrated" : `${entry.personalRating}/10 personal rating`}`
                  : "No active personal entry found for this title."}
          </dd>
        </div>
        {entry?.personalReview && (
          <div>
            <dt>Your review</dt>
            <dd>{entry.personalReview}</dd>
          </div>
        )}
      </dl>
    </details>
  );
}
export function DuplicateReview({
  matches,
  title,
  onContinue,
  onClose,
}: {
  matches: DuplicateMatch[];
  title: string;
  onContinue: () => void;
  onClose: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const element = dialog.current;
    element?.showModal();
    return () => element?.close();
  }, []);
  const strong = matches.some((match) => match.strength === "strong");
  return (
    <dialog
      ref={dialog}
      className="duplicate-dialog"
      onCancel={onClose}
      aria-labelledby="duplicate-heading"
    >
      <div className="duplicate-heading">
        <AlertTriangle size={23} className="accent" />
        <button
          className="icon-button"
          onClick={onClose}
          aria-label="Close duplicate review"
        >
          <X size={21} />
        </button>
      </div>
      <p className="eyebrow">ALREADY PART OF YOUR WORLD?</p>
      <h2 id="duplicate-heading">
        {strong
          ? "This production already exists."
          : "A familiar title in your archive."}
      </h2>
      <p>
        We checked “{title}” against your local records.{" "}
        {strong
          ? "An identical external identity cannot become a separate title. Inspect the existing record below or return to discovery."
          : "These may be different productions. Review the local information before preparing a separate draft."}
      </p>
      {matches.map((match) => (
        <ExistingRecord key={match.title.id} match={match} />
      ))}
      <p className="preference-note">
        No ratings, reviews, metadata, or categories have been changed.
      </p>
      <div className="dialog-actions">
        <button className="secondary-button" onClick={onClose}>
          Back to editing
        </button>
        {!strong && (
          <button className="button" onClick={onContinue}>
            Different production · continue <ArrowRight size={14} />
          </button>
        )}
      </div>
    </dialog>
  );
}
