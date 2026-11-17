import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { catalog } from "../services/catalog";
import { prepareTitleDraft } from "../services/titleDraft";
import type { TitleDraft } from "../services/tmdb/types";
import type { DuplicateMatch } from "../types/domain";

export function usePrepareDraft() {
  const navigate = useNavigate();
  const [pending, setPending] = useState<{
    draft: TitleDraft;
    matches: DuplicateMatch[];
  } | null>(null);
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  function finish(draft: TitleDraft) {
    prepareTitleDraft(draft);
    setPending(null);
    navigate("/draft");
  }
  async function check(draft: TitleDraft) {
    setChecking(true);
    setError(null);
    try {
      const matches = await catalog.titles.findDuplicates(draft.metadata);
      if (matches.length) {
        setPending({ draft, matches });
        return false;
      }
      finish(draft);
      return true;
    } catch {
      setError(
        "The local duplicate check could not be completed. Restore local storage access and try again. Your metadata has not been saved or discarded.",
      );
      return false;
    } finally {
      setChecking(false);
    }
  }
  return {
    check,
    checking,
    error,
    pending,
    cancel: () => setPending(null),
    confirm: () => {
      if (
        pending &&
        !pending.matches.some((match) => match.strength === "strong")
      )
        finish({ ...pending.draft, confirmedPossibleDuplicate: true });
    },
  };
}
