import { Link, useParams, useSearchParams } from "react-router-dom";
import { useState } from "react";
import { FilePenLine, Search, Tv, ArrowRight } from "lucide-react";
import { MovieForm } from "../components/movies/MovieForm";
import {
  EmptyState,
  LoadingState,
  PageHeader,
} from "../components/common/States";
import { useShow } from "../hooks/useCatalog";
import { useTitleDraft } from "../hooks/useTitleDraft";
import type { ShowRecord } from "../services/showService";
import "../styles/shows.css";
function EditShow({ id }: { id: string }) {
  const result = useShow(id);
  if (result.isLoading) return <LoadingState message="Opening your show…" />;
  if (result.error || !result.data)
    return (
      <section className="panel">
        <EmptyState
          icon={Tv}
          title="This show could not be opened."
          description={result.error?.message ?? "No local record was found."}
        >
          <Link className="button" to="/shows">
            Back to shows
          </Link>
        </EmptyState>
      </section>
    );
  return <Snapshot key={id} record={result.data} />;
}
function Snapshot({ record }: { record: ShowRecord }) {
  const [snapshot] = useState(record);
  return snapshot.entry.deletedAt ? (
    <section className="panel">
      <EmptyState
        icon={Tv}
        title="This show is archived."
        description="Restore it before editing."
      >
        <Link className="button" to={`/shows/${record.title.id}`}>
          View archived show
        </Link>
      </EmptyState>
    </section>
  ) : (
    <MovieForm movie={snapshot} mediaType="tv" />
  );
}
export default function ShowEditorPage() {
  const { id } = useParams(),
    [params] = useSearchParams(),
    draft = useTitleDraft();
  if (id) return <EditShow id={id} />;
  if (params.get("draft") === "1") {
    if (!draft || draft.metadata.mediaType !== "tv")
      return (
        <section className="panel">
          <EmptyState
            icon={Tv}
            title="No TV draft is available."
            description="Drafts disappear on reload. Choose manual entry or search TMDB; no incomplete show has been saved."
          >
            <div className="empty-state-actions">
              <Link className="button" to="/shows/new?method=manual">
                Enter manually
              </Link>
              <Link className="secondary-button" to="/discover?type=tv">
                Search TV shows
              </Link>
            </div>
          </EmptyState>
        </section>
      );
    return <MovieForm mediaType="tv" draft={draft} key={draft.preparedAt} />;
  }
  if (params.get("method") === "manual")
    return <MovieForm mediaType="tv" key="manual-show" />;
  return (
    <>
      <PageHeader
        eyebrow="THE FIRST EPISODE"
        title="A story worth staying with."
        description="Find a series or miniseries, then make its place in your personal cinema."
      />
      <section className="movie-entry-methods">
        <Link className="panel movie-method" to="/discover?type=tv">
          <Search size={30} />
          <span className="eyebrow">OPTIONAL · TMDB</span>
          <h2>Find your next chapter.</h2>
          <p>
            Search television, choose metadata and creators, then add your own
            viewing record.
          </p>
          <span>
            Search TV shows <ArrowRight size={15} />
          </span>
        </Link>
        <Link className="panel movie-method" to="/shows/new?method=manual">
          <FilePenLine size={30} />
          <span className="eyebrow">LOCAL · NO TOKEN NEEDED</span>
          <h2>Tell it your way.</h2>
          <p>
            Start with a title, genre, and status. Season and episode details
            can wait.
          </p>
          <span>
            Enter manually <ArrowRight size={15} />
          </span>
        </Link>
      </section>
    </>
  );
}
