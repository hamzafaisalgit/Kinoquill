import type { TitleDraft } from "./tmdb/types";
import { titleCreateSchema, validate } from "../utils/validation";

let draft: TitleDraft | null = null;
const listeners = new Set<() => void>();
export const subscribeTitleDraft = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};
export const getTitleDraft = () => draft;
export function prepareTitleDraft(input: TitleDraft) {
  draft = structuredClone({
    ...input,
    metadata: validate(titleCreateSchema, input.metadata),
  });
  listeners.forEach((listener) => listener());
}
export function clearTitleDraft() {
  draft = null;
  listeners.forEach((listener) => listener());
}
