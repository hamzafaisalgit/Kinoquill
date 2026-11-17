import type { TvProgress } from "../../utils/tvProgress";
export function ProgressIndicator({ summary }: { summary: TvProgress }) {
  return (
    <div className="tv-progress">
      <div>
        <strong>
          {summary.watched}{" "}
          {summary.approximate ? "approximately watched" : "watched"}{" "}
          <span>/ {summary.total ?? "unknown total"}</span>
        </strong>
        <span>
          {summary.percentage === null
            ? "Progress incomplete"
            : `${Math.round(summary.percentage)}%`}
        </span>
      </div>
      {summary.percentage !== null && (
        <progress
          max={100}
          value={summary.percentage}
          aria-label="Overall recorded episode progress"
        />
      )}
      <p>
        {summary.completedSeasons} completed seasons · {summary.partialSeasons}{" "}
        in progress
        {summary.approximate ? " · Includes approximate season counts" : ""}
      </p>
      <small>
        Based on all known episodes, including {summary.future} with future air
        dates. Specials excluded unless enabled. Watch status is always your
        choice.
      </small>
    </div>
  );
}
