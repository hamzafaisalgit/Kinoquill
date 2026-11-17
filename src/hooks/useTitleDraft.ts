import { useSyncExternalStore } from "react";
import { getTitleDraft, subscribeTitleDraft } from "../services/titleDraft";
export function useTitleDraft() {
  return useSyncExternalStore(
    subscribeTitleDraft,
    getTitleDraft,
    getTitleDraft,
  );
}
