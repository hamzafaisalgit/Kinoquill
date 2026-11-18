import type { Timestamped } from "./domain";
import type { LibraryPreferences } from "../utils/libraryState";
export interface CustomList extends Timestamped {
  id: string;
  name: string;
  description: string | null;
}
export interface ListItem {
  id: string;
  listId: string;
  titleId: string;
  position: number;
  createdAt: string;
}
export interface Tag extends Timestamped {
  id: string;
  name: string;
  normalizedName: string;
}
export interface TitleTag {
  titleId: string;
  tagId: string;
}
export interface SavedView extends Timestamped {
  id: string;
  name: string;
  description: string | null;
  route: "/library" | "/movies" | "/shows" | "/watchlist" | "/favorites";
  params: string;
  display: LibraryPreferences;
}
export interface JournalPreferences {
  pageSize: 12 | 24 | 48;
  showCardYear: boolean;
  showCardRating: boolean;
  posters: boolean;
  reducedMotion: boolean;
  expandSeasons: boolean;
  includeSpecials: boolean;
  progressStyle: "bar" | "numbers";
  backupInterval: 0 | 7 | 30 | 90;
  lastBackupAt: string | null;
  remindAfter: string | null;
}
export const JOURNAL_DEFAULTS: JournalPreferences = {
  pageSize: 24,
  showCardYear: true,
  showCardRating: true,
  posters: true,
  reducedMotion: false,
  expandSeasons: false,
  includeSpecials: false,
  progressStyle: "bar",
  backupInterval: 0,
  lastBackupAt: null,
  remindAfter: null,
};
