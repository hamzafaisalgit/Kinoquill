import { Link, useParams, useSearchParams } from "react-router-dom";
import { useState } from "react";
import type { MovieRecord } from "../services/movieService";
import { ArrowRight, Clapperboard, FilePenLine, Search } from "lucide-react";
import { MovieForm } from "../components/movies/MovieForm";
import {
  EmptyState,
  LoadingState,
  PageHeader,
} from "../components/common/States";
import { useMovie } from "../hooks/useCatalog";
import { useTitleDraft } from "../hooks/useTitleDraft";
import "../styles/movies.css";

function EditMovie({ id }: { id: string }) {
  const movie = useMovie(id);
  if (movie.isLoading)
    return <LoadingState message="Reading your saved movie…" />;
  if (movie.error || !movie.data)
    return (
      <section className="panel">
        <EmptyState
          icon={Clapperboard}
          title="This movie couldn’t be opened."
          description={movie.error?.message ?? "The record is unavailable."}
        >
          <Link className="button" to="/movies">
            Back to movies
          </Link>
        </EmptyState>
      </section>
    );
  // Keep the original form snapshot while live queries publish changes. Save uses
  // revisions to detect concurrent edits rather than resetting the user's input.
  return <LoadedEditor key={id} record={movie.data} />;
}
function LoadedEditor({ record }: { record: MovieRecord }) {
  const [snapshot] = useState(record);
  return snapshot.entry.deletedAt ? (
    <section className="panel">
      <EmptyState
        icon={Clapperboard}
        title="This movie is archived."
        description="Restore the existing record before editing. Your rating, review, and history have been kept."
      >
        <Link className="button" to={`/movies/${snapshot.title.id}`}>
          View archived movie
        </Link>
      </EmptyState>
    </section>
  ) : (
    <MovieForm movie={snapshot} />
  );
}
export default function MovieEditorPage() {
  const { id } = useParams();
  const [params] = useSearchParams();
  const draft = useTitleDraft();
  if (id) return <EditMovie id={id} />;
  const method = params.get("method");
  if (params.get("draft") === "1") {
    if (!draft)
      return (
        <>
          <PageHeader
            eyebrow="YOUR NEXT CHAPTER"
            title="Your movie draft is no longer in this tab."
            description="Prepared metadata is session-only. Choose manual entry or discovery to begin again."
          />
          <section className="panel">
            <EmptyState
              icon={FilePenLine}
              title="No metadata draft available."
              description="No incomplete record was saved. Your existing library is unaffected."
            >
              <div className="empty-state-actions">
                <Link className="button" to="/movies/new?method=manual">
                  Enter manually
                </Link>
                <Link className="secondary-button" to="/discover?type=movie">
                  Search TMDB
                </Link>
              </div>
            </EmptyState>
          </section>
        </>
      );
    if (draft.metadata.mediaType !== "movie")
      return (
        <section className="panel">
          <EmptyState
            icon={Clapperboard}
            title="This draft belongs to a TV show."
            description="Movie entry accepts movies only. The full TV workflow arrives in Phase 5."
          >
            <Link className="button" to="/draft">
              Back to prepared draft
            </Link>
          </EmptyState>
        </section>
      );
    return <MovieForm key={draft.preparedAt} draft={draft} />;
  }
  if (method === "manual") return <MovieForm key="manual" />;
  return (
    <>
      <PageHeader
        eyebrow="THE FIRST FRAME"
        title="Every collection begins with a film."
        description="Start with a discovery, or tell the story in your own words."
      />
      <section className="movie-entry-methods">
        <Link className="panel movie-method" to="/discover?type=movie">
          <Search size={30} strokeWidth={1.3} />
          <span className="eyebrow">OPTIONAL · TMDB</span>
          <h2>Find your film.</h2>
          <p>
            Search real productions, preview the metadata, and bring your
            selection into an editable movie form.
          </p>
          <span>
            Search TMDB <ArrowRight size={16} />
          </span>
        </Link>
        <Link className="panel movie-method" to="/movies/new?method=manual">
          <FilePenLine size={30} strokeWidth={1.3} />
          <span className="eyebrow">LOCAL · NO TOKEN NEEDED</span>
          <h2>Make it your own.</h2>
          <p>
            A title, a genre, and your perspective. Enter a film manually,
            online or offline after the app loads.
          </p>
          <span>
            Enter manually <ArrowRight size={16} />
          </span>
        </Link>
      </section>
      <p className="movies-footer-note">
        Both methods use the same local save transaction. Nothing is saved until
        you choose Save movie.
      </p>
    </>
  );
}
