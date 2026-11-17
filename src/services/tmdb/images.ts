export type ImageSize = "w92" | "w185" | "w342" | "w500" | "w780" | "w1280";
/** Accept only TMDB file paths; arbitrary URLs and path traversal are rejected. */
export function tmdbImage(
  path: string | null | undefined,
  size: ImageSize = "w342",
): string | null {
  if (!path || !/^\/[a-zA-Z0-9_-]+\.(jpg|jpeg|png|webp)$/i.test(path))
    return null;
  return `https://image.tmdb.org/t/p/${size}${path}`;
}
