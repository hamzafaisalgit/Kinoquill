import type { WatchStatus } from "../types/domain";
export const MOVIE_STATUSES: { value: WatchStatus; label: string }[] = [
  { value: "watchlist", label: "Watchlist" },
  { value: "watching", label: "Watching" },
  { value: "completed", label: "Watched" },
  { value: "on_hold", label: "On hold" },
  { value: "dropped", label: "Dropped" },
];
export function movieStatus(status: WatchStatus) {
  return (
    MOVIE_STATUSES.find((option) => option.value === status)?.label ??
    (status === "unknown" ? "Needs review" : "Caught up · legacy status")
  );
}
