import { useState } from "react";
import type { FormEvent } from "react";
import type { Category, Genre } from "../../types/domain";
import { Dialog } from "../common/Dialog";
export function LibraryFilters({
  params,
  genres,
  categories,
  languages,
  countries,
  onApply,
  onClose,
}: {
  params: URLSearchParams;
  genres: Genre[];
  categories: Category[];
  languages: string[];
  countries: string[];
  onApply: (params: URLSearchParams) => void;
  onClose: () => void;
}) {
  const [failure, setFailure] = useState<string | null>(null);
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget),
      next = new URLSearchParams(params);
    for (const key of [
      "genre",
      "genreMatch",
      "category",
      "categoryMatch",
      "minRating",
      "maxRating",
      "unrated",
      "minYear",
      "maxYear",
      "favorite",
      "language",
      "country",
      "addedFrom",
      "addedTo",
      "watchedFrom",
      "watchedTo",
    ]) {
      next.delete(key);
      for (const value of form.getAll(key))
        if (String(value).trim()) next.append(key, String(value));
    }
    for (const [from, to] of [
      ["minRating", "maxRating"],
      ["minYear", "maxYear"],
      ["addedFrom", "addedTo"],
      ["watchedFrom", "watchedTo"],
    ]) {
      const first = next.get(from),
        last = next.get(to);
      if (
        first &&
        last &&
        (from.startsWith("min") ? Number(first) > Number(last) : first > last)
      ) {
        setFailure(
          "Each minimum or start date must be no greater than its maximum or end date.",
        );
        return;
      }
    }
    next.delete("page");
    onApply(next);
    onClose();
  }
  return (
    <Dialog title="Find your kind of story" onClose={onClose} wide>
      <p>
        Filter groups combine with AND. Choose ANY or ALL within genres and
        categories.
      </p>
      <form onSubmit={submit} className="library-filter-form">
        <div className="library-filter-columns">
          <fieldset>
            <legend>Genres</legend>
            <label>
              Match
              <select
                name="genreMatch"
                defaultValue={params.get("genreMatch") ?? "any"}
              >
                <option value="any">Any selected genre</option>
                <option value="all">All selected genres</option>
              </select>
            </label>
            <div className="library-filter-options">
              {genres.map((genre) => (
                <label key={genre.id}>
                  <input
                    type="checkbox"
                    name="genre"
                    value={genre.id}
                    defaultChecked={params.getAll("genre").includes(genre.id)}
                  />
                  {genre.name}
                </label>
              ))}
            </div>
          </fieldset>
          <fieldset>
            <legend>Personal categories</legend>
            <label>
              Match
              <select
                name="categoryMatch"
                defaultValue={params.get("categoryMatch") ?? "any"}
              >
                <option value="any">Any selected category</option>
                <option value="all">All selected categories</option>
              </select>
            </label>
            <div className="library-filter-options">
              {categories.length ? (
                categories.map((category) => (
                  <label key={category.id}>
                    <input
                      type="checkbox"
                      name="category"
                      value={category.id}
                      defaultChecked={params
                        .getAll("category")
                        .includes(category.id)}
                    />
                    {category.name}
                  </label>
                ))
              ) : (
                <p>No categories yet.</p>
              )}
            </div>
          </fieldset>
        </div>
        <div className="library-filter-columns">
          <fieldset>
            <legend>Personal rating</legend>
            <div className="library-filter-range">
              <label>
                Minimum
                <input
                  name="minRating"
                  type="number"
                  min="0"
                  max="10"
                  step="any"
                  defaultValue={params.get("minRating") ?? ""}
                  placeholder="0"
                />
              </label>
              <label>
                Maximum
                <input
                  name="maxRating"
                  type="number"
                  min="0"
                  max="10"
                  step="any"
                  defaultValue={params.get("maxRating") ?? ""}
                  placeholder="10"
                />
              </label>
            </div>
            <label className="library-check">
              <input
                type="checkbox"
                name="unrated"
                value="1"
                defaultChecked={params.get("unrated") === "1"}
              />
              Unrated only
            </label>
            <small>Blank ratings are separate from a genuine zero.</small>
          </fieldset>
          <fieldset>
            <legend>Release year</legend>
            <div className="library-filter-range">
              <label>
                From
                <input
                  name="minYear"
                  type="number"
                  min="1"
                  max="9999"
                  step="1"
                  defaultValue={params.get("minYear") ?? ""}
                />
              </label>
              <label>
                To
                <input
                  name="maxYear"
                  type="number"
                  min="1"
                  max="9999"
                  step="1"
                  defaultValue={params.get("maxYear") ?? ""}
                />
              </label>
            </div>
            <label className="library-check">
              <input
                type="checkbox"
                name="favorite"
                value="1"
                defaultChecked={params.get("favorite") === "1"}
              />
              Favorites only
            </label>
          </fieldset>
          <fieldset>
            <legend>Language</legend>
            <div className="library-filter-options">
              {languages.length ? (
                languages.map((language) => (
                  <label key={language}>
                    <input
                      type="checkbox"
                      name="language"
                      value={language}
                      defaultChecked={params
                        .getAll("language")
                        .includes(language)}
                    />
                    {language}
                  </label>
                ))
              ) : (
                <p>No recorded languages.</p>
              )}
            </div>
          </fieldset>
          <fieldset>
            <legend>Production country</legend>
            <div className="library-filter-options">
              {countries.length ? (
                countries.map((country) => (
                  <label key={country}>
                    <input
                      type="checkbox"
                      name="country"
                      value={country}
                      defaultChecked={params
                        .getAll("country")
                        .includes(country)}
                    />
                    {country}
                  </label>
                ))
              ) : (
                <p>No recorded countries.</p>
              )}
            </div>
          </fieldset>
          <fieldset>
            <legend>Date added</legend>
            <div className="library-filter-range">
              <label>
                From
                <input
                  name="addedFrom"
                  type="date"
                  defaultValue={params.get("addedFrom") ?? ""}
                />
              </label>
              <label>
                To
                <input
                  name="addedTo"
                  type="date"
                  defaultValue={params.get("addedTo") ?? ""}
                />
              </label>
            </div>
          </fieldset>
          <fieldset>
            <legend>Date watched / completed</legend>
            <div className="library-filter-range">
              <label>
                From
                <input
                  name="watchedFrom"
                  type="date"
                  defaultValue={params.get("watchedFrom") ?? ""}
                />
              </label>
              <label>
                To
                <input
                  name="watchedTo"
                  type="date"
                  defaultValue={params.get("watchedTo") ?? ""}
                />
              </label>
            </div>
            <small>
              Matches recorded completion/viewing dates by overlapping their
              known day, month, or year. Unknown dates are excluded.
            </small>
          </fieldset>
        </div>
        {failure && (
          <p className="field-error" role="alert">
            {failure}
          </p>
        )}
        <div className="dialog-actions">
          <button type="button" className="secondary-button" onClick={onClose}>
            Cancel
          </button>
          <button className="button">Apply filters</button>
        </div>
      </form>
    </Dialog>
  );
}
