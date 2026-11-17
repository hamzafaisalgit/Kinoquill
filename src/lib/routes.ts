import {
  LayoutDashboard,
  Film,
  Tv,
  Bookmark,
  Heart,
  ChartNoAxesCombined,
  ArrowLeftRight,
  Settings,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

export interface CollectionRoute {
  path: string;
  label: string;
  icon: LucideIcon;
  eyebrow: string;
  description: string;
  emptyTitle: string;
  emptyDescription: string;
  action: string;
}

export const collectionRoutes: CollectionRoute[] = [
  {
    path: "/movies",
    label: "Movies",
    icon: Film,
    eyebrow: "THE FEATURE COLLECTION",
    description: "A home for every film that stays with you.",
    emptyTitle: "Every collection starts with one film.",
    emptyDescription:
      "Your posters, personal ratings, and film notes will live here. Movie entry arrives in a later phase.",
    action: "Add movie · Phase 4",
  },
  {
    path: "/shows",
    label: "TV Shows",
    icon: Tv,
    eyebrow: "ONE EPISODE AT A TIME",
    description: "Keep your stories close, from the pilot to the finale.",
    emptyTitle: "Your next great series belongs here.",
    emptyDescription:
      "A dedicated space for series, miniseries, anime, and K-dramas. Season and episode tracking arrive in a later phase.",
    action: "Add TV show",
  },
  {
    path: "/watchlist",
    label: "Watchlist",
    icon: Bookmark,
    eyebrow: "FOR ANOTHER EVENING",
    description: "All the stories you’re looking forward to.",
    emptyTitle: "Something to look forward to.",
    emptyDescription:
      "Titles you save for later will appear here once title management is available.",
    action: "Save a title",
  },
  {
    path: "/favorites",
    label: "Favorites",
    icon: Heart,
    eyebrow: "THE ONES THAT STAY",
    description: "Some stories deserve a place of their own.",
    emptyTitle: "Make room for your all-time favorites.",
    emptyDescription:
      "Your most-loved movies and shows will gather here when favorites become available.",
    action: "Choose favorites",
  },
];

export const navigation = [
  { path: "/", label: "Dashboard", icon: LayoutDashboard },
  ...collectionRoutes,
  { path: "/analytics", label: "Analytics", icon: ChartNoAxesCombined },
  { path: "/import-export", label: "Import & Export", icon: ArrowLeftRight },
  { path: "/settings", label: "Settings", icon: Settings },
];
