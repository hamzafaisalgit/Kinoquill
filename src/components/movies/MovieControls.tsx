import { useState } from "react";
import { Plus, Search, Star, X } from "lucide-react";
import type { DateValue, Person } from "../../types/domain";
import type { DirectorChoice } from "../../services/movieService";
import { normalizeName } from "../../utils/normalization";
import { UNKNOWN_DATE } from "../../utils/dates";

export function NameMultiSelect({
  label,
  options,
  value,
  onChange,
  error,
  loading = false,
}: {
  label: string;
  options: string[];
  value: string[];
  onChange: (value: string[]) => void;
  error?: string;
  loading?: boolean;
}) {
  const [query, setQuery] = useState("");
  const all = [
    ...new Map(
      [...options, ...value].map((name) => [normalizeName(name), name]),
    ).values(),
  ];
  const matches = all.filter((name) =>
    normalizeName(name).includes(normalizeName(query)),
  );
  const canCreate =
    query.trim() &&
    !all.some((name) => normalizeName(name) === normalizeName(query));
  function toggle(name: string) {
    onChange(
      value.some((item) => normalizeName(item) === normalizeName(name))
        ? value.filter((item) => normalizeName(item) !== normalizeName(name))
        : [...value, name],
    );
  }
  return (
    <fieldset className="movie-multi-select">
      <legend>{label}</legend>
      <div className="selected-chips">
        {value.map((name) => (
          <span key={name}>
            {name}
            <button
              type="button"
              aria-label={`Remove ${name}`}
              onClick={() => toggle(name)}
            >
              <X size={12} />
            </button>
          </span>
        ))}
        {!value.length && <small>Nothing selected yet</small>}
      </div>
      <label className="movie-select-search">
        <Search size={14} />
        <input
          aria-label={`Search ${label.toLowerCase()}`}
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={`Find or create ${label.toLowerCase()}…`}
        />
      </label>
      {loading && <p className="preference-note">Loading local options…</p>}
      <div className="movie-select-options">
        {matches.map((name) => (
          <label key={name}>
            <input
              type="checkbox"
              checked={value.some(
                (item) => normalizeName(item) === normalizeName(name),
              )}
              onChange={() => toggle(name)}
            />
            <span>{name}</span>
          </label>
        ))}
      </div>
      {canCreate && (
        <button
          type="button"
          className="text-button"
          onClick={() => {
            onChange([...value, query.trim()]);
            setQuery("");
          }}
        >
          <Plus size={13} />
          Use new {label === "Genres" ? "genre" : "category"} “{query.trim()}”
        </button>
      )}
      <p className="preference-note">
        New names are created only when the movie is saved.
      </p>
      {error && (
        <p className="movie-field-error" role="alert">
          {error}
        </p>
      )}
    </fieldset>
  );
}
export function DirectorInput({
  options,
  value,
  onChange,
}: {
  options: Person[];
  value: DirectorChoice[];
  onChange: (value: DirectorChoice[]) => void;
}) {
  const [query, setQuery] = useState("");
  const results = query.trim()
    ? options
        .filter(
          (person) =>
            person.normalizedName.includes(normalizeName(query)) &&
            !value.some((selected) => selected.id === person.id),
        )
        .slice(0, 8)
    : [];
  return (
    <fieldset className="movie-multi-select">
      <legend>
        Directors{" "}
        <span className="optional-note">Optional · manually controlled</span>
      </legend>
      <div className="selected-chips">
        {value.map((person, index) => (
          <span key={person.id ?? `new:${index}`}>
            {person.name}
            <button
              type="button"
              onClick={() =>
                onChange(value.filter((_, itemIndex) => itemIndex !== index))
              }
              aria-label={`Remove director ${person.name}`}
            >
              <X size={12} />
            </button>
          </span>
        ))}
        {!value.length && <small>No directors selected</small>}
      </div>
      <label className="movie-select-search">
        <Search size={14} />
        <input
          aria-label="Find or add a director"
          placeholder="Search a name, or add someone new…"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
      </label>
      <div className="director-suggestions">
        {results.map((person) => (
          <button
            type="button"
            key={person.id}
            onClick={() => {
              onChange([...value, { id: person.id, name: person.name }]);
              setQuery("");
            }}
          >
            {person.name}
            <small>Existing person · {person.id.slice(0, 8)}</small>
            <Plus size={13} />
          </button>
        ))}
      </div>
      {query.trim() && (
        <button
          type="button"
          className="text-button"
          onClick={() => {
            onChange([...value, { name: query.trim() }]);
            setQuery("");
          }}
        >
          <Plus size={13} />
          Add “{query.trim()}” as a new person
        </button>
      )}
      <p className="preference-note">
        Removing a chip only unlinks this movie. Existing people are kept.
        Matching names can identify different people.
      </p>
    </fieldset>
  );
}
export function RatingInput({
  value,
  onChange,
  required,
  historical,
  error,
}: {
  value: number | null;
  onChange: (value: number | null) => void;
  required: boolean;
  historical: boolean;
  error?: string;
}) {
  const nonHalf = value !== null && !Number.isInteger(value * 2);
  return (
    <fieldset className="movie-rating">
      <legend>
        <Star size={15} />
        My rating{" "}
        <span>{required ? "Required for watched movies" : "Optional"}</span>
      </legend>
      <div className="rating-readout">
        <strong>
          {value === null ? "—" : value.toString()}
          <small>{value === null ? "Unrated" : "/ 10"}</small>
        </strong>
        <button
          type="button"
          className="text-button"
          onClick={() => onChange(value === null ? 0 : null)}
        >
          {value === null ? "Rate this movie" : "Clear rating"}
        </button>
      </div>
      <input
        type="range"
        min="0"
        max="10"
        step={historical && nonHalf ? ".1" : ".5"}
        value={value ?? 5}
        aria-label="Personal rating slider"
        aria-valuetext={
          value === null
            ? "Unrated; move to assign a rating"
            : `${value} out of 10`
        }
        onChange={(event) =>
          onChange(Math.round(Number(event.target.value) * 2) / 2)
        }
      />
      <div className="rating-precise">
        <span>0 — 10 · half-point increments</span>
        <input
          type="number"
          min="0"
          max="10"
          step=".5"
          aria-label="Exact personal rating"
          value={value ?? ""}
          placeholder="Unrated"
          onChange={(event) =>
            onChange(
              event.target.value === "" ? null : Number(event.target.value),
            )
          }
        />
      </div>
      {historical && nonHalf && (
        <p className="preference-note">
          Historical rating {value} is preserved exactly. Newly entered ratings
          use half points.
        </p>
      )}
      {error && (
        <p className="movie-field-error" role="alert">
          {error}
        </p>
      )}
    </fieldset>
  );
}
export function DateWatchedInput({
  value,
  onChange,
  error,
}: {
  value: DateValue;
  onChange: (value: DateValue) => void;
  error?: string;
}) {
  return (
    <fieldset className="movie-date">
      <legend>
        Date watched <span className="optional-note">Optional</span>
      </legend>
      <div>
        <select
          aria-label="Viewing date precision"
          value={value.precision}
          onChange={(event) => {
            const precision = event.target.value as DateValue["precision"];
            onChange(
              precision === "unknown" ? UNKNOWN_DATE : { precision, value: "" },
            );
          }}
        >
          <option value="unknown">Unknown / not recorded</option>
          <option value="day">Exact day</option>
          <option value="month">Month & year</option>
          <option value="year">Year only</option>
        </select>
        {value.precision !== "unknown" && (
          <input
            aria-label="Date watched"
            type={
              value.precision === "day"
                ? "date"
                : value.precision === "month"
                  ? "month"
                  : "number"
            }
            min={value.precision === "year" ? "1" : undefined}
            max={value.precision === "year" ? "9999" : undefined}
            value={value.value}
            onChange={(event) =>
              onChange({ ...value, value: event.target.value })
            }
          />
        )}
      </div>
      <p className="preference-note">
        No date is assumed. An explicitly recorded date updates your first-watch
        session, without changing rewatches.
      </p>
      {error && (
        <p className="movie-field-error" role="alert">
          {error}
        </p>
      )}
    </fieldset>
  );
}
