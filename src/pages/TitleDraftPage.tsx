import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  ArrowUpRight,
  Check,
  FilePenLine,
  Pencil,
  Trash2,
} from "lucide-react";
import {
  EmptyState,
  PageHeader,
  UpcomingButton,
} from "../components/common/States";
import { ManualDraftForm } from "../components/discovery/ManualDraftForm";
import { PosterArtwork } from "../components/discovery/PosterArtwork";
import { DuplicateReview } from "../components/discovery/DuplicateReview";
import { clearTitleDraft } from "../services/titleDraft";
import { useTitleDraft } from "../hooks/useTitleDraft";
import { usePrepareDraft } from "../hooks/usePrepareDraft";
import "../styles/discovery.css";

export default function TitleDraftPage() {
  const draft = useTitleDraft();
  const [editing, setEditing] = useState(false);
  const prepare = usePrepareDraft();
  const navigate = useNavigate();
  if (!draft)
    return (
      <>
        <PageHeader
          eyebrow="YOUR NEXT CHAPTER"
          title="A little room for a new story."
          description="Prepare metadata through discovery or enter it in your own words."
        />
        <section className="panel">
          <EmptyState
            icon={FilePenLine}
            title="No prepared draft in this tab."
            description="Drafts are held only for this page session and disappear on reload. Your saved local library is unaffected."
          >
            <div className="empty-state-actions">
              <Link className="button" to="/discover">
                Discover a title <ArrowUpRight size={15} />
              </Link>
              <Link className="secondary-button" to="/discover?manual=1">
                Enter manually
              </Link>
            </div>
          </EmptyState>
        </section>
      </>
    );
  return (
    <div className="title-draft-page">
      <PageHeader
        eyebrow="PREPARED. STILL YOURS TO CHANGE."
        title={
          editing
            ? "Put it in your own words."
            : "Your next story, on the page."
        }
        description="Metadata draft only. Nothing has been saved to your personal library."
        action={
          <Link className="secondary-button" to="/discover">
            <ArrowLeft size={14} />
            Discovery
          </Link>
        }
      />
      {editing ? (
        <section className="panel manual-panel">
          <ManualDraftForm
            key={draft.preparedAt}
            initial={draft}
            onPrepare={async (value) => {
              if (await prepare.check(value)) setEditing(false);
            }}
          />
        </section>
      ) : (
        <PreparedSummary
          draft={draft}
          onEdit={() => setEditing(true)}
          onDiscard={() => {
            if (
              window.confirm(
                "Discard this prepared metadata draft? Your saved library will not be changed.",
              )
            ) {
              clearTitleDraft();
              navigate("/discover");
            }
          }}
        />
      )}
      {prepare.error && (
        <p className="field-error" role="alert">
          {prepare.error}
        </p>
      )}
      {prepare.pending && (
        <DuplicateReview
          matches={prepare.pending.matches}
          title={prepare.pending.draft.metadata.title}
          onContinue={() => {
            prepare.confirm();
            setEditing(false);
          }}
          onClose={prepare.cancel}
        />
      )}
    </div>
  );
}

function PreparedSummary({
  draft,
  onEdit,
  onDiscard,
}: {
  draft: NonNullable<ReturnType<typeof useTitleDraft>>;
  onEdit: () => void;
  onDiscard: () => void;
}) {
  return (
    <section className="panel prepared-draft">
      <div className="prepared-draft-poster">
        <PosterArtwork
          path={draft.metadata.posterPath}
          title={draft.metadata.title}
          size="w500"
        />
      </div>
      <div className="prepared-draft-copy">
        <span className="pill">
          <Check size={12} />
          {draft.source === "tmdb"
            ? "TMDB METADATA PREPARED"
            : "MANUAL METADATA PREPARED"}
        </span>
        <h2>{draft.metadata.title}</h2>
        <p className="metadata-line">
          <span>
            {draft.metadata.mediaType === "movie"
              ? "Movie"
              : draft.metadata.mediaSubtype === "tv_miniseries"
                ? "TV miniseries"
                : "TV show"}
          </span>
          <span>{draft.metadata.releaseYear ?? "Year unknown"}</span>
          <span>
            {draft.metadata.runtimeMinutes
              ? `${draft.metadata.runtimeMinutes} min${draft.metadata.mediaType === "tv" ? " typical episode" : ""}`
              : "Runtime unknown"}
          </span>
        </p>
        <div className="metadata-genres">
          {draft.genres.map((name) => (
            <span className="outline-pill" key={name}>
              {name}
            </span>
          ))}
          {!draft.genres.length && (
            <span className="outline-pill">
              Genres need review before final entry
            </span>
          )}
        </div>
        <p className="metadata-overview">
          {draft.metadata.overview ||
            "No overview entered. You can add one while editing this draft."}
        </p>
        <dl className="metadata-facts">
          <div>
            <dt>
              {draft.metadata.mediaType === "movie"
                ? "Chosen directors"
                : "Chosen creators"}
            </dt>
            <dd>
              {draft.people.map((person) => person.name).join(", ") ||
                "Not entered · optional"}
            </dd>
          </div>
          <div>
            <dt>Release date</dt>
            <dd>{draft.metadata.releaseDate || "Unknown"}</dd>
          </div>
          <div>
            <dt>Draft lifetime</dt>
            <dd>This tab, until reload or discard</dd>
          </div>
        </dl>
        <div className="draft-handoff-note">
          <FilePenLine size={20} />
          <div>
            <strong>Ready for the next chapter.</strong>
            <p>
              The full{" "}
              {draft.metadata.mediaType === "movie"
                ? "movie form is ready for your personal record"
                : "TV form arrives in Phase 5"}
              . Ratings, reviews, viewing dates, and a real library save happen
              there. This draft has not created a title or personal entry.
            </p>
          </div>
        </div>
        <div className="empty-state-actions">
          <button className="button" onClick={onEdit}>
            <Pencil size={14} />
            Edit metadata
          </button>
          {draft.metadata.mediaType === "movie" ? (
            <Link className="button" to="/movies/new?draft=1">
              Continue to movie form <ArrowUpRight size={14} />
            </Link>
          ) : (
            <UpcomingButton>Save to library · Phase 5</UpcomingButton>
          )}
          <button className="text-button" onClick={onDiscard}>
            <Trash2 size={14} />
            Discard draft
          </button>
        </div>
      </div>
    </section>
  );
}
