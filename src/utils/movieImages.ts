import { tmdbImage } from "../services/tmdb/images";
import type { ImageSize } from "../services/tmdb/images";
export function movieImage(
  path: string | null | undefined,
  size: ImageSize = "w342",
): string | null {
  const tmdb = tmdbImage(path, size);
  if (tmdb) return tmdb;
  if (!path) return null;
  try {
    const url = new URL(path);
    return url.protocol === "https:" && !url.username && !url.password
      ? url.href
      : null;
  } catch {
    return null;
  }
}
