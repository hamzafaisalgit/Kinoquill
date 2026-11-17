import { LibraryExplorer } from "../components/library/LibraryExplorer";
import { ArchivedCollection } from "../components/library/ArchivedCollection";
export function MovieCollection({
  kind = "movies",
}: {
  kind?: "movies" | "watchlist" | "favorites";
}) {
  return (
    <>
      <LibraryExplorer scope={kind} />
      {kind === "movies" && <ArchivedCollection mediaType="movie" />}
    </>
  );
}
export default function MoviesPage() {
  return <MovieCollection />;
}
