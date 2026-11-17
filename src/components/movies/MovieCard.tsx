import { useState } from "react";
import { Link } from "react-router-dom";
import { Heart, Star } from "lucide-react";
import { toast } from "sonner";
import type { LibraryItem } from "../../types/domain";
import { catalog } from "../../services/catalog";
import { PosterArtwork } from "../discovery/PosterArtwork";
import { movieStatus } from "../../utils/movieStatus";
export function MovieCard({ item }: { item: LibraryItem }) {
  const [busy, setBusy] = useState(false);
  async function favorite() {
    setBusy(true);
    try {
      await catalog.movies.setFavorite(item.title.id, !item.entry.isFavorite);
    } catch {
      toast.error("Favorite could not be updated. Please try again.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <article className="movie-card">
      <Link
        to={`/movies/${item.title.id}`}
        className="movie-card-art"
        aria-label={`Open ${item.title.title}`}
      >
        <PosterArtwork
          path={item.title.posterPath}
          title={item.title.title}
          allowExternal
        />
        <span className={`movie-status-badge status-${item.entry.status}`}>
          {movieStatus(item.entry.status)}
        </span>
      </Link>
      <button
        className={`movie-card-favorite ${item.entry.isFavorite ? "active" : ""}`}
        aria-label={`${item.entry.isFavorite ? "Remove" : "Add"} ${item.title.title} ${item.entry.isFavorite ? "from" : "to"} favorites`}
        aria-pressed={item.entry.isFavorite}
        disabled={busy}
        onClick={() => void favorite()}
      >
        <Heart
          size={16}
          fill={item.entry.isFavorite ? "currentColor" : "none"}
        />
      </button>
      <div className="movie-card-info">
        <Link to={`/movies/${item.title.id}`}>
          <h2>{item.title.title}</h2>
        </Link>
        <div>
          <span>{item.title.releaseYear ?? "Year unknown"}</span>
          {item.entry.personalRating !== null ? (
            <span
              className="movie-card-rating"
              aria-label={`${item.entry.personalRating} out of 10 personal rating`}
            >
              <Star size={11} />
              {item.entry.personalRating}
            </span>
          ) : (
            <span>Unrated</span>
          )}
        </div>
      </div>
    </article>
  );
}
