import { useRef, useState } from "react";
export function personalError(error: unknown) {
  if (error instanceof Error && error.name === "QuotaExceededError")
    return "Browser storage is full. No partial operation was committed. Free some space and try again.";
  return error instanceof Error
    ? error.message
    : "This local operation could not be completed. Please try again.";
}
export function usePersonalAction() {
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    guard = useRef(false);
  async function run(action: () => Promise<unknown>) {
    if (guard.current) return;
    guard.current = true;
    setBusy(true);
    setError("");
    try {
      await action();
    } catch (error) {
      setError(personalError(error));
    } finally {
      guard.current = false;
      setBusy(false);
    }
  }
  return { busy, error, run };
}
