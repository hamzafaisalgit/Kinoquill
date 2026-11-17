import type { TitleInput } from "../../utils/validation";
import type { MediaType } from "../../types/domain";

export type SearchMode = "all" | MediaType;
export interface SearchResult {
  id: number;
  mediaType: MediaType;
  title: string;
  releaseYear: number | null;
  overview: string | null;
  posterPath: string | null;
  communityRating: number | null;
}
export interface PersonSuggestion {
  name: string;
  role: "director" | "creator";
}
/** Metadata only: never contains personal ratings, status, or viewing dates. */
export interface TitleDraft {
  metadata: TitleInput;
  genres: string[];
  people: PersonSuggestion[];
  source: "manual" | "tmdb";
  preparedAt: string;
  confirmedPossibleDuplicate: boolean;
}
export interface DiscoveryMetadata {
  metadata: TitleInput;
  genres: string[];
  suggestions: PersonSuggestion[];
  communityRating: number | null;
  lastAirDate: string | null;
  productionStatus: string | null;
  seasonCount: number | null;
  episodeCount: number | null;
  seasons: {
    number: number;
    name: string;
    episodeCount: number | null;
    airDate: string | null;
  }[];
}
