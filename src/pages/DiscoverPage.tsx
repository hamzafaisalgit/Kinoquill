import { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import {
  ArrowLeft,
  ArrowUpRight,
  Clapperboard,
  Film,
  KeyRound,
  PenLine,
  Search,
  ShieldCheck,
  Tv,
  X,
} from "lucide-react";
import {
  EmptyState,
  LoadingState,
  PageHeader,
} from "../components/common/States";
import { PosterArtwork } from "../components/discovery/PosterArtwork";
import { MetadataPreview } from "../components/discovery/MetadataPreview";
import { ManualDraftForm } from "../components/discovery/ManualDraftForm";
import { DuplicateReview } from "../components/discovery/DuplicateReview";
import { useTmdbSession } from "../hooks/useTmdbSession";
import { usePrepareDraft } from "../hooks/usePrepareDraft";
import { useTitleDraft } from "../hooks/useTitleDraft";
import { searchTitles, getTitleDetails } from "../services/tmdb/api";
import { metadataError } from "../services/tmdb/errors";
import type {
  DiscoveryMetadata,
  SearchMode,
  SearchResult,
  TitleDraft,
} from "../services/tmdb/types";
import "../styles/discovery.css";

type SearchState = {
  phase: "idle" | "loading" | "ready" | "error";
  items: SearchResult[];
  error: string | null;
  key: string;
};
export default function DiscoverPage() {
  const session = useTmdbSession();
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const query = params.get("q") ?? "";
  const mode: SearchMode =
    params.get("type") === "movie"
      ? "movie"
      : params.get("type") === "tv"
        ? "tv"
        : "all";
  const [manual, setManual] = useState(params.get("manual") === "1");
  const [initialDraft, setInitialDraft] = useState<TitleDraft | undefined>();
  const [search, setSearch] = useState<SearchState>({
    phase: "idle",
    items: [],
    error: null,
    key: "",
  });
  const [selected, setSelected] = useState<SearchResult | null>(null);
  const [details, setDetails] = useState<{
    key: string;
    data?: DiscoveryMetadata;
    error?: string;
  } | null>(null);
  const [retry, setRetry] = useState(0);
  const results = useRef<(HTMLButtonElement | null)[]>([]);
  const searchInput = useRef<HTMLInputElement>(null);
  const preparation = usePrepareDraft();
  const preparedDraft = useTitleDraft();
  useEffect(() => {
    if (!manual && !selected) searchInput.current?.focus();
  }, [manual, selected]);
  const searchKey = `${mode}:${query.trim()}:${session.revision}:${retry}`;
  const selectionKey = selected
    ? `${selected.mediaType}:${selected.id}:${session.revision}:${retry}`
    : "";
  const currentSearch =
    search.key === searchKey
      ? search
      : {
          phase:
            query.trim().length >= 2 && session.configured
              ? ("loading" as const)
              : ("idle" as const),
          items: [],
          error: null,
        };

  useEffect(() => {
    if (!session.configured || query.trim().length < 2 || manual || selected)
      return;
    const controller = new AbortController();
    const timer = setTimeout(() => {
      setSearch({ phase: "loading", items: [], error: null, key: searchKey });
      void searchTitles(query, mode, controller.signal)
        .then((items) => {
          if (!controller.signal.aborted)
            setSearch({ phase: "ready", items, error: null, key: searchKey });
        })
        .catch((error) => {
          if (!controller.signal.aborted)
            setSearch({
              phase: "error",
              items: [],
              error: metadataError(error),
              key: searchKey,
            });
        });
    }, 350);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [
    query,
    mode,
    session.configured,
    session.revision,
    manual,
    selected,
    searchKey,
  ]);

  useEffect(() => {
    if (!selected || manual) return;
    const controller = new AbortController();
    void getTitleDetails(selected.id, selected.mediaType, controller.signal)
      .then((data) => {
        if (!controller.signal.aborted) setDetails({ key: selectionKey, data });
      })
      .catch((error) => {
        if (!controller.signal.aborted)
          setDetails({ key: selectionKey, error: metadataError(error) });
      });
    return () => controller.abort();
  }, [selected, selectionKey, manual]);

  function updateSearch(nextQuery: string, nextMode = mode) {
    setParams(
      {
        ...(nextQuery ? { q: nextQuery } : {}),
        ...(nextMode !== "all" ? { type: nextMode } : {}),
      },
      { replace: true },
    );
  }
  function enterManual(draft?: TitleDraft) {
    setInitialDraft(draft);
    setManual(true);
  }
  const metadata = details?.key === selectionKey ? details : null;
  return (
    <div
      className="discovery-page"
      onKeyDown={(event) => {
        if (event.key === "Escape" && !preparation.pending) {
          if (selected) setSelected(null);
          else if (manual) setManual(false);
          else navigate("/");
        }
      }}
    >
      <PageHeader
        eyebrow="THE NEXT STORY STARTS HERE"
        title="A world beyond your watchlist."
        description="Find a film. Follow a series. Make a discovery your own."
        action={
          <Link
            className="secondary-button"
            to="/"
            aria-label="Close discovery"
          >
            <X size={16} />
            Close
          </Link>
        }
      />
      {preparedDraft && !manual && !selected && (
        <Link className="draft-resume-strip" to="/draft">
          <PenLine size={17} />
          <span>
            Continue your prepared draft
            <strong>{preparedDraft.metadata.title}</strong>
          </span>
          <ArrowUpRight size={17} />
        </Link>
      )}
      {manual ? (
        <section className="panel manual-panel">
          <div className="manual-panel-nav">
            <button className="text-button" onClick={() => setManual(false)}>
              <ArrowLeft size={15} />
              Back to discovery
            </button>
            <span className="outline-pill">METADATA DRAFT</span>
          </div>
          <ManualDraftForm
            key={initialDraft?.preparedAt ?? "new"}
            initial={initialDraft}
            defaultType={selected?.mediaType ?? (mode === "tv" ? "tv" : "movie")}
            onPrepare={preparation.check}
          />
        </section>
      ) : selected ? (
        <>
          {metadata?.data ? (
            <MetadataPreview
              key={selectionKey}
              details={metadata.data}
              checking={preparation.checking}
              onUse={preparation.check}
              onBack={() => {
                setSelected(null);
                searchInput.current?.focus();
              }}
              onManual={enterManual}
            />
          ) : (
            <section className="panel detail-pending">
              <button className="text-button" onClick={() => setSelected(null)}>
                <ArrowLeft size={15} />
                Back to results
              </button>
              {metadata?.error ? (
                <EmptyState
                  icon={Clapperboard}
                  title="The details couldn’t reach us."
                  description={metadata.error}
                >
                  <div className="empty-state-actions">
                    <button
                      className="button"
                      onClick={() => setRetry(retry + 1)}
                    >
                      Try again
                    </button>
                    <button
                      className="secondary-button"
                      onClick={() => enterManual()}
                    >
                      Enter manually
                    </button>
                  </div>
                </EmptyState>
              ) : (
                <LoadingState
                  message={`Finding the details of ${selected.title}…`}
                />
              )}
            </section>
          )}
        </>
      ) : (
        <>
          <section className="discovery-search-panel panel">
            <div className="discovery-search-heading">
              <div className="discovery-symbol" aria-hidden="true">
                <Search size={25} strokeWidth={1.3} />
              </div>
              <div>
                <p className="eyebrow">DISCOVER WITH TMDB</p>
                <h2>What story are you looking for?</h2>
                <p>Movies and series, with room for your own perspective.</p>
              </div>
              <span className="discovery-edition">
                THE DISCOVERY ROOM
                <br />
                <span>CHAPTER 03</span>
              </span>
            </div>
            <label className="discovery-search-input">
              <Search size={23} strokeWidth={1.5} />
              <span className="sr-only">Search TMDB titles</span>
              <input
                ref={searchInput}
                autoFocus
                value={query}
                onChange={(event) => updateSearch(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "ArrowDown" && results.current[0]) {
                    event.preventDefault();
                    results.current[0].focus();
                  }
                }}
                placeholder="Search a movie or TV show…"
                maxLength={200}
                autoComplete="off"
                aria-describedby="search-guidance"
              />
              {query && (
                <button
                  className="icon-button"
                  onClick={() => {
                    updateSearch("");
                    searchInput.current?.focus();
                  }}
                  aria-label="Clear search"
                >
                  <X size={17} />
                </button>
              )}
              <kbd>TMDB</kbd>
            </label>
            <div className="search-panel-bottom">
              <div
                className="search-modes"
                role="group"
                aria-label="Search media type"
              >
                {(
                  [
                    { type: "all", label: "All titles", icon: Clapperboard },
                    { type: "movie", label: "Movies", icon: Film },
                    { type: "tv", label: "TV shows", icon: Tv },
                  ] as const
                ).map(({ type, label, icon: Icon }) => (
                  <button
                    key={type}
                    className={mode === type ? "selected" : ""}
                    aria-pressed={mode === type}
                    onClick={() => updateSearch(query, type)}
                  >
                    <Icon size={15} />
                    {label}
                  </button>
                ))}
              </div>
              <button className="text-button" onClick={() => enterManual()}>
                <PenLine size={14} />
                Enter manually <ArrowUpRight size={13} />
              </button>
            </div>
          </section>
          <div className="discovery-results-heading">
            <h2>
              {query.trim().length >= 2
                ? "Your search, a little closer."
                : "There’s always another story."}
            </h2>
            <span id="search-guidance">
              {session.configured
                ? "Type at least 2 characters · ↑ ↓ to navigate · Enter to preview"
                : "TMDB is optional. Your archive stays local."}
            </span>
          </div>
          {!session.configured ? (
            <section className="panel discovery-no-token">
              <div className="discovery-no-token-art" aria-hidden="true">
                <div />
                <Clapperboard size={70} strokeWidth={0.7} />
                <span>
                  THE POSSIBILITIES
                  <br />
                  <em>are endless.</em>
                </span>
              </div>
              <div className="discovery-no-token-copy">
                <span className="pill">
                  <KeyRound size={12} />
                  YOUR TOKEN. YOUR SESSION.
                </span>
                <h2>Open the door to discovery.</h2>
                <p>
                  Connect your TMDB Read Access Token to explore real movie and
                  TV metadata. Or start with a title you already have in mind.
                </p>
                <div className="empty-state-actions">
                  <Link className="button" to="/settings#tmdb-settings">
                    Configure TMDB <ArrowUpRight size={15} />
                  </Link>
                  <button
                    className="secondary-button"
                    onClick={() => enterManual()}
                  >
                    <PenLine size={14} />
                    Enter manually
                  </button>
                </div>
                <p className="discovery-privacy">
                  <ShieldCheck size={14} />
                  No account required for Kinoquill. Your token stays in memory.
                </p>
              </div>
            </section>
          ) : query.trim().length < 2 ? (
            <section className="panel search-idle">
              <EmptyState
                icon={Search}
                title="Begin with a name."
                description="Search the title that caught your eye. We’ll find matching productions so you can choose the right one."
              />
            </section>
          ) : currentSearch.phase === "loading" ? (
            <div
              className="search-skeletons"
              role="status"
              aria-label="Searching TMDB"
            >
              {Array.from({ length: 4 }, (_, index) => (
                <div className="panel search-skeleton" key={index}>
                  <span />
                  <div>
                    <i />
                    <i />
                    <i />
                  </div>
                </div>
              ))}
            </div>
          ) : currentSearch.phase === "error" ? (
            <section className="panel search-idle">
              <EmptyState
                icon={Clapperboard}
                title="A pause in the picture."
                description={currentSearch.error ?? "Search is unavailable."}
              >
                <div className="empty-state-actions">
                  <button
                    className="button"
                    onClick={() => setRetry(retry + 1)}
                  >
                    Retry search
                  </button>
                  <button
                    className="secondary-button"
                    onClick={() => enterManual()}
                  >
                    Enter manually
                  </button>
                </div>
              </EmptyState>
            </section>
          ) : currentSearch.phase === "ready" && !currentSearch.items.length ? (
            <section className="panel search-idle">
              <EmptyState
                icon={Search}
                title="No matching stories this time."
                description="Try another spelling, switch the media filter, or prepare a manual draft."
              >
                <button
                  className="secondary-button"
                  onClick={() => enterManual()}
                >
                  Enter manually
                </button>
              </EmptyState>
            </section>
          ) : (
            <section className="search-results" aria-label="TMDB title results">
              {currentSearch.items.map((item, index) => (
                <button
                  className="search-result-card panel"
                  key={`${item.mediaType}:${item.id}`}
                  ref={(element) => {
                    results.current[index] = element;
                  }}
                  onClick={() => setSelected(item)}
                  onKeyDown={(event) => {
                    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
                      event.preventDefault();
                      results.current[
                        (index +
                          (event.key === "ArrowDown" ? 1 : -1) +
                          currentSearch.items.length) %
                          currentSearch.items.length
                      ]?.focus();
                    }
                  }}
                >
                  <PosterArtwork
                    path={item.posterPath}
                    title={item.title}
                    size="w185"
                  />
                  <div>
                    <span className="result-type">
                      {item.mediaType === "movie" ? "MOVIE" : "TV SHOW"}
                      <ArrowUpRight size={14} />
                    </span>
                    <h3>{item.title}</h3>
                    <span className="result-year">
                      {item.releaseYear ?? "Year unknown"}
                      {item.communityRating !== null
                        ? ` · TMDB ${item.communityRating.toFixed(1)}/10`
                        : ""}
                    </span>
                    <p>
                      {item.overview ||
                        "No overview available. Select to explore the details."}
                    </p>
                    <small>
                      Preview metadata <ArrowRightIcon />
                    </small>
                  </div>
                </button>
              ))}
            </section>
          )}
          <p className="discovery-footnote">
            Search and artwork are provided by TMDB. Community ratings are
            external; they are never your personal ratings.
          </p>
        </>
      )}
      {preparation.error && (
        <p role="alert" className="field-error">
          {preparation.error}
        </p>
      )}
      {preparation.pending && (
        <DuplicateReview
          matches={preparation.pending.matches}
          title={preparation.pending.draft.metadata.title}
          onContinue={preparation.confirm}
          onClose={preparation.cancel}
        />
      )}
    </div>
  );
}
function ArrowRightIcon() {
  return <ArrowUpRight size={12} />;
}
