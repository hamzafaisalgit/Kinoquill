import { AddToListButton } from "../personal/Lists";
import { useLocalStorage } from "../../hooks/useLocalStorage";
import { journalPreferences } from "../../services/preferences";
import { useState } from "react";
import { Link } from "react-router-dom";
import { Heart, Star } from "lucide-react";
import { toast } from "sonner";
import type { LibraryItem } from "../../types/domain";
import { catalog } from "../../services/catalog";
import { PosterArtwork } from "../discovery/PosterArtwork";
import { movieStatus } from "../../utils/movieStatus";
export function MovieCard({
  item,
  returnTo,
}: {
  item: LibraryItem;
  returnTo?: string;
}) {
  const preferences = journalPreferences(useLocalStorage().settings.journal);
  const isShow = item.title.mediaType === "tv";
  const base = isShow ? "/shows" : "/movies";
  const [busy, setBusy] = useState(false);
  async function favorite() {
    setBusy(true);
    try {
      await (isShow ? catalog.shows : catalog.movies).setFavorite(
        item.title.id,
        !item.entry.isFavorite,
      );
    } catch {
      toast.error("Favorite could not be updated. Please try again.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <article className="movie-card">
      <Link
        to={`${base}/${item.title.id}`}
        state={returnTo ? { returnTo } : undefined}
        className="movie-card-art"
        aria-label={`Open ${item.title.title}`}
      >
        <PosterArtwork
          path={preferences.posters ? item.title.posterPath : null}
          title={item.title.title}
          allowExternal
        />
        <span className={`movie-status-badge status-${item.entry.status}`}>
          {isShow && item.entry.status === "completed"
            ? "Completed"
            : movieStatus(item.entry.status)}
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
        <Link
          to={`${base}/${item.title.id}`}
          state={returnTo ? { returnTo } : undefined}
        >
          <h2>{item.title.title}</h2>
        </Link>
        <div>
          {preferences.showCardYear && (
            <span>{item.title.releaseYear ?? "Year unknown"}</span>
          )}
          {preferences.showCardRating &&
            (item.entry.personalRating !== null ? (
              <span
                className="movie-card-rating"
                aria-label={`${item.entry.personalRating} out of 10 personal rating`}
              >
                <Star size={11} />
                {item.entry.personalRating}
              </span>
            ) : (
              <span>Unrated</span>
            ))}
        </div>
      </div>
      <AddToListButton titleIds={[item.title.id]} />
    </article>
  );
}
