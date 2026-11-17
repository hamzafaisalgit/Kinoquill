import { useRef, useEffect, useState } from "react";
import {
  ExternalLink,
  Eye,
  EyeOff,
  KeyRound,
  ShieldCheck,
  Trash2,
} from "lucide-react";
import { useTmdbSession } from "../../hooks/useTmdbSession";
import {
  configureTmdbToken,
  removeTmdbToken,
  testTmdbConnection,
} from "../../services/tmdb/client";
import { metadataError } from "../../services/tmdb/errors";
import { clearMetadataCache } from "../../services/tmdb/cache";

export function TmdbSettings() {
  const session = useTmdbSession();
  const [input, setInput] = useState("");
  const [visible, setVisible] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cacheMessage, setCacheMessage] = useState("");
  const controller = useRef<AbortController | null>(null);
  useEffect(() => () => controller.current?.abort(), []);
  async function test() {
    setError(null);
    controller.current?.abort();
    controller.current = new AbortController();
    try {
      if (input.trim()) {
        configureTmdbToken(input);
        setInput("");
        setVisible(false);
      }
      await testTmdbConnection(controller.current.signal);
    } catch (error) {
      if (!(error instanceof DOMException && error.name === "AbortError"))
        setError(metadataError(error));
    }
  }
  return (
    <section
      className="panel tmdb-settings"
      id="tmdb-settings"
      aria-labelledby="tmdb-settings-heading"
    >
      <div className="panel-header">
        <div>
          <p className="eyebrow">OPTIONAL · SESSION ONLY</p>
          <h2 id="tmdb-settings-heading">Movie & TV Metadata — TMDB</h2>
          <p>Connect a world of cinema to your personal archive.</p>
        </div>
        <KeyRound size={23} className="accent" />
      </div>
      <div className="tmdb-settings-body">
        <p className="body-copy">
          Your own TMDB API Read Access Token enables live movie and series
          discovery. You can prepare metadata manually without a token.
        </p>
        <label className="field-label" htmlFor="tmdb-token">
          API Read Access Token
        </label>
        <div className="token-input-row">
          <input
            id="tmdb-token"
            type={visible ? "text" : "password"}
            value={input}
            onChange={(event) => {
              setInput(event.target.value);
              setError(null);
            }}
            placeholder={
              session.configured
                ? "A token is held for this session. Paste here to replace it."
                : "Paste your Read Access Token"
            }
            autoComplete="off"
            autoCapitalize="none"
            spellCheck={false}
            aria-describedby="token-privacy"
          />
          <button
            className="icon-button"
            type="button"
            onClick={() => setVisible(!visible)}
            aria-label={visible ? "Hide token" : "Show token"}
            aria-pressed={visible}
          >
            {visible ? <EyeOff size={18} /> : <Eye size={18} />}
          </button>
        </div>
        <div className="settings-metadata-actions">
          <button
            className="button"
            onClick={() => void test()}
            disabled={
              session.status === "testing" ||
              (!input.trim() && !session.configured)
            }
          >
            {session.status === "testing"
              ? "Testing connection…"
              : "Test connection"}
          </button>
          <button
            className="secondary-button"
            disabled={!session.configured && !input}
            onClick={() => {
              controller.current?.abort();
              removeTmdbToken();
              setInput("");
              setError(null);
              setVisible(false);
            }}
          >
            <Trash2 size={14} />
            Remove token
          </button>
          <a
            className="text-link"
            href="https://www.themoviedb.org/settings/api"
            target="_blank"
            rel="noreferrer"
          >
            Get a token <ExternalLink size={13} />
          </a>
        </div>
        <p
          className={`tmdb-connection ${session.status === "connected" ? "verified" : ""}`}
          role="status"
        >
          {error ?? session.message}
        </p>
        <div className="privacy-note" id="token-privacy">
          <ShieldCheck size={19} />
          <p>
            The token stays in this tab’s memory and is removed on reload. It is
            sent only to TMDB’s API. Browser scripts and developer tools can
            access a browser-held token; this is not server-side secret
            protection. Nothing is saved to IndexedDB or localStorage.
          </p>
        </div>
        <div className="cache-control">
          <p>
            Selected details stay in memory for up to 5 minutes (24 titles
            maximum). Posters need internet access.
          </p>
          <button
            className="text-button"
            onClick={() => {
              clearMetadataCache();
              setCacheMessage(
                "Metadata cache cleared. Your library and prepared draft were not changed.",
              );
            }}
          >
            Clear metadata cache
          </button>
        </div>
        {cacheMessage && (
          <p className="preference-note" role="status">
            {cacheMessage}
          </p>
        )}
        <div className="tmdb-credits">
          <a href="https://www.themoviedb.org" target="_blank" rel="noreferrer">
            <img src="/tmdb-logo.svg" alt="TMDB" width="90" height="16" />
          </a>
          <div>
            <strong>Metadata & artwork credits</strong>
            <p>
              This product uses the TMDB API but is not endorsed or certified by
              TMDB.
            </p>
            <a
              href="https://developer.themoviedb.org/docs/getting-started"
              target="_blank"
              rel="noreferrer"
            >
              TMDB API documentation <ExternalLink size={12} />
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}
