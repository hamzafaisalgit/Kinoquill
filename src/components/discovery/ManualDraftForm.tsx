import { useState } from "react";
import type { FormEvent } from "react";
import { ArrowRight, PenLine } from "lucide-react";
import { useGenres } from "../../hooks/useCatalog";
import { titleCreateSchema, validate } from "../../utils/validation";
import { normalizeName } from "../../utils/normalization";
import type { TitleDraft } from "../../services/tmdb/types";
import type { MediaType } from "../../types/domain";

export function ManualDraftForm({
  initial,
  defaultType = "movie",
  onPrepare,
}: {
  initial?: TitleDraft;
  defaultType?: MediaType;
  onPrepare: (draft: TitleDraft) => Promise<unknown>;
}) {
  const catalogGenres = useGenres();
  const [title, setTitle] = useState(initial?.metadata.title ?? "");
  const [type, setType] = useState<MediaType>(
    initial?.metadata.mediaType ?? defaultType,
  );
  const [miniseries, setMiniseries] = useState(
    initial?.metadata.mediaSubtype === "tv_miniseries",
  );
  const [year, setYear] = useState(
    initial?.metadata.releaseYear?.toString() ?? "",
  );
  const [runtime, setRuntime] = useState(
    initial?.metadata.runtimeMinutes?.toString() ?? "",
  );
  const [genres, setGenres] = useState<string[]>(initial?.genres ?? []);
  const [personText, setPersonText] = useState(
    initial?.people.map((person) => person.name).join("\n") ?? "",
  );
  const [overview, setOverview] = useState(initial?.metadata.overview ?? "");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const options = [
    ...new Map([
      ...(catalogGenres.data ?? []).map(
        (genre) => [normalizeName(genre.name), genre.name] as const,
      ),
      ...genres.map((name) => [normalizeName(name), name] as const),
    ]).values(),
  ].sort();
  async function submit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const sameType = !initial || initial.metadata.mediaType === type;
      const metadata = validate(titleCreateSchema, {
        ...(sameType ? initial?.metadata : {}),
        title,
        mediaType: type,
        mediaSubtype:
          type === "movie"
            ? "movie"
            : miniseries
              ? "tv_miniseries"
              : "tv_series",
        releaseYear: year.trim() ? Number(year) : null,
        runtimeMinutes: runtime.trim() ? Number(runtime) : null,
        overview: overview.trim() || null,
        releaseDate:
          year && initial?.metadata.releaseDate?.startsWith(year) && sameType
            ? initial.metadata.releaseDate
            : null,
        metadataSource:
          initial?.source === "tmdb" && sameType ? "tmdb" : "manual",
      });
      const people = personText
        .split("\n")
        .map((name) => name.trim())
        .filter(Boolean)
        .map((name) => ({
          name,
          role: type === "movie" ? ("director" as const) : ("creator" as const),
        }));
      await onPrepare({
        metadata,
        genres,
        people,
        source: initial?.source === "tmdb" && sameType ? "tmdb" : "manual",
        preparedAt: new Date().toISOString(),
        confirmedPossibleDuplicate: false,
      });
    } catch (error) {
      setError(
        error instanceof Error ? error.message : "Please review your draft.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <form
      className="manual-draft-form"
      onSubmit={(event) => void submit(event)}
    >
      <div className="manual-form-heading">
        <span className="empty-icon">
          <PenLine size={23} />
        </span>
        <div>
          <p className="eyebrow">YOUR WORDS. YOUR CHOICE.</p>
          <h2>{initial ? "Refine your metadata." : "Start with a title."}</h2>
          <p>
            Metadata only. Personal ratings, reviews, and final saving arrive in
            later phases.
          </p>
        </div>
      </div>
      <div className="metadata-form-grid">
        <label className="wide-field">
          Title <span className="required-note">Required</span>
          <input
            required
            maxLength={500}
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="The name of a story worth keeping"
          />
        </label>
        <label>
          Media type
          <select
            value={type}
            onChange={(event) => setType(event.target.value as MediaType)}
          >
            <option value="movie">Movie</option>
            <option value="tv">TV show</option>
          </select>
        </label>
        <label>
          Release year <span className="optional-note">Optional</span>
          <input
            type="number"
            min="1"
            max="9999"
            step="1"
            value={year}
            onChange={(event) => setYear(event.target.value)}
            placeholder="Unknown"
          />
        </label>
        {type === "tv" && (
          <label className="setting-checkbox wide-field">
            <input
              type="checkbox"
              checked={miniseries}
              onChange={(event) => setMiniseries(event.target.checked)}
            />
            This is a miniseries
          </label>
        )}
        <fieldset className="wide-field genre-picker">
          <legend>
            Genres <span className="optional-note">Choose what you know</span>
          </legend>
          {catalogGenres.isLoading && (
            <p className="preference-note">Loading your genre catalog…</p>
          )}
          {catalogGenres.error && (
            <p className="field-error">
              The local genre catalog is unavailable. You can prepare an
              incomplete draft and review it later.
            </p>
          )}
          <div className="genre-options">
            {options.map((name) => (
              <label key={name}>
                <input
                  type="checkbox"
                  checked={genres.includes(name)}
                  onChange={(event) =>
                    setGenres(
                      event.target.checked
                        ? [...genres, name]
                        : genres.filter((value) => value !== name),
                    )
                  }
                />
                <span>{name}</span>
              </label>
            ))}
          </div>
        </fieldset>
        <label>
          {type === "movie"
            ? "Runtime (minutes)"
            : "Typical episode runtime (minutes)"}
          <input
            type="number"
            min="1"
            step="1"
            value={runtime}
            onChange={(event) => setRuntime(event.target.value)}
            placeholder="Unknown"
          />
        </label>
        <label>
          {type === "movie" ? "Directors" : "Creators"}{" "}
          <span className="optional-note">Optional</span>
          <textarea
            rows={2}
            value={personText}
            onChange={(event) => setPersonText(event.target.value)}
            placeholder="One name per line"
          />
        </label>
        <label className="wide-field">
          Overview <span className="optional-note">Optional</span>
          <textarea
            rows={4}
            value={overview}
            onChange={(event) => setOverview(event.target.value)}
            placeholder="A few words about the story…"
          />
        </label>
      </div>
      {error && (
        <p className="field-error" role="alert">
          {error}
        </p>
      )}
      <div className="manual-form-footer">
        <p>
          This prepares a session-only draft. It does not add a title to your
          library.
        </p>
        <button className="button" disabled={busy} type="submit">
          {busy ? "Checking local matches…" : "Prepare metadata draft"}
          <ArrowRight size={15} />
        </button>
      </div>
    </form>
  );
}
