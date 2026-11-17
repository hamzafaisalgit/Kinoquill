import { useLocalStorage } from "../../hooks/useLocalStorage";

const labels = {
  initializing: "Initializing Storage",
  ready: "Local Storage Ready",
  unavailable: "Storage Unavailable",
  error: "Storage Error",
};

export function LocalStorageStatus() {
  const storage = useLocalStorage();
  return (
    <span
      className={`status-indicator ${storage.phase === "ready" ? "online" : storage.phase === "initializing" ? "checking" : "offline"}`}
      role="status"
      title={
        storage.error ??
        "IndexedDB opened and a local write/read operation verified."
      }
    >
      <span className="status-dot" />
      {labels[storage.phase]}
    </span>
  );
}
