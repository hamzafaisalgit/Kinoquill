import { useRef, useState } from "react";
import { Link } from "react-router-dom";
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { Download, ImageDown } from "lucide-react";
import type { ChartRow } from "../../analytics/types";
import { exportChartCsv, exportChartPng } from "../../analytics/exports";
export interface Series {
  key: string;
  label: string;
}
const colors = ["#d6b87c", "#6fa9a6", "#8798b7"];
export function ChartCard({
  title,
  caption,
  rows,
  series,
  context,
  href,
  line = false,
  horizontal = false,
}: {
  title: string;
  caption: string;
  rows: ChartRow[];
  series: Series[];
  context: string;
  href?: (row: ChartRow) => string;
  line?: boolean;
  horizontal?: boolean;
}) {
  const host = useRef<HTMLDivElement>(null);
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const hasData = rows.some((r) =>
    series.some((s) => typeof r[s.key] === "number" && Number(r[s.key]) !== 0),
  );
  // Zero-valued observations are meaningful (for example a genre average of 0).
  const hasObservation =
    hasData ||
    rows.some((r) =>
      series.some((s) => s.key === "average" && r[s.key] !== null),
    );
  async function png() {
    if (!host.current) return;
    setBusy(true);
    try {
      await exportChartPng(title, host.current, context);
      setNotice("PNG download requested.");
    } catch (e) {
      setNotice(e instanceof Error ? e.message : "Image export failed.");
    } finally {
      setBusy(false);
    }
  }
  const axes = (
    <>
      <CartesianGrid
        stroke="#282e3a"
        strokeDasharray="3 5"
        horizontal={!horizontal}
        vertical={horizontal}
      />
      <XAxis
        type={horizontal ? "number" : "category"}
        dataKey={horizontal ? undefined : "name"}
        domain={
          horizontal && series.some((s) => s.key === "average")
            ? [0, 10]
            : undefined
        }
        tick={{ fill: "#9ca5b5", fontSize: 11 }}
        axisLine={false}
        tickLine={false}
        minTickGap={18}
      />
      <YAxis
        type={horizontal ? "category" : "number"}
        dataKey={horizontal ? "name" : undefined}
        width={horizontal ? 110 : 38}
        domain={
          !horizontal && series.some((s) => s.key === "average")
            ? [0, 10]
            : undefined
        }
        tickFormatter={
          horizontal
            ? (value: string) =>
                value.length > 17 ? `${value.slice(0, 16)}…` : value
            : undefined
        }
        tick={{ fill: "#9ca5b5", fontSize: 11 }}
        axisLine={false}
        tickLine={false}
      />
      <Tooltip
        contentStyle={{
          background: "#191e2a",
          border: "1px solid #393f4b",
          borderRadius: 10,
          color: "#f3f5f8",
        }}
        formatter={(value) =>
          typeof value === "number"
            ? new Intl.NumberFormat("en", { maximumFractionDigits: 2 }).format(
                value,
              )
            : value
        }
      />
      <Legend wrapperStyle={{ fontSize: 11, paddingTop: 14 }} />
    </>
  );
  const shown = rows.slice(0, horizontal ? 12 : 80);
  return (
    <section className="panel analytic-chart">
      <div className="analytic-chart-head">
        <div>
          <h3>{title}</h3>
          <p>{caption}</p>
        </div>
        <div className="chart-actions">
          <button
            type="button"
            disabled={!rows.length}
            aria-label={`Download ${title} CSV`}
            title="Download supporting data (CSV)"
            onClick={() => {
              try {
                exportChartCsv(title, rows, context);
                setNotice("CSV download requested.");
              } catch (e) {
                setNotice(String(e));
              }
            }}
          >
            <Download size={16} />
          </button>
          <button
            type="button"
            disabled={!hasObservation || busy}
            aria-label={`Download ${title} PNG`}
            title="Download chart (PNG)"
            onClick={() => void png()}
          >
            <ImageDown size={16} />
          </button>
        </div>
      </div>
      {hasObservation ? (
        <div
          ref={host}
          className="analytic-chart-canvas"
          style={{
            height: horizontal ? Math.max(240, shown.length * 30 + 65) : 270,
          }}
        >
          <ResponsiveContainer width="100%" height="100%" minWidth={0}>
            {line ? (
              <LineChart
                data={shown}
                margin={{ left: 0, right: 16, top: 12, bottom: 4 }}
              >
                {axes}
                {series.map((s, i) => (
                  <Line
                    key={s.key}
                    dataKey={s.key}
                    name={s.label}
                    stroke={colors[i % 3]}
                    strokeWidth={2}
                    dot={false}
                    connectNulls={false}
                    isAnimationActive={false}
                  />
                ))}
              </LineChart>
            ) : (
              <BarChart
                data={shown}
                layout={horizontal ? "vertical" : "horizontal"}
                margin={{ left: 0, right: 16, top: 12, bottom: 4 }}
              >
                {axes}
                {series.map((s, i) => (
                  <Bar
                    key={s.key}
                    dataKey={s.key}
                    name={s.label}
                    fill={colors[i % 3]}
                    radius={horizontal ? [0, 3, 3, 0] : [3, 3, 0, 0]}
                    maxBarSize={28}
                    isAnimationActive={false}
                  />
                ))}
              </BarChart>
            )}
          </ResponsiveContainer>
        </div>
      ) : (
        <div className="analytic-empty">
          <span>NO OBSERVATIONS YET</span>
          <p>
            There is not enough recorded information for this chart in the
            current selection.
          </p>
        </div>
      )}
      {rows.length > 0 && (
        <details className="chart-data">
          <summary>
            Explore data
            {rows.length > shown.length ? " · chart shows a subset" : ""}
          </summary>
          <div className="analytics-table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Group</th>
                  {series.map((s) => (
                    <th key={s.key}>{s.label}</th>
                  ))}
                  {rows.some((r) => "rated" in r) && (
                    <>
                      <th>Rated sample</th>
                      <th>Collection titles</th>
                      <th>Mean rating /10</th>
                    </>
                  )}
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr key={`${r.name}:${i}`}>
                    <th>
                      {href ? <Link to={href(r)}>{r.name} ↗</Link> : r.name}
                    </th>
                    {series.map((s) => (
                      <td key={s.key}>
                        {r[s.key] === null
                          ? "Unknown"
                          : typeof r[s.key] === "number"
                            ? new Intl.NumberFormat("en", {
                                maximumFractionDigits: 2,
                              }).format(Number(r[s.key]))
                            : r[s.key]}
                      </td>
                    ))}
                    {rows.some((r) => "rated" in r) && (
                      <>
                        <td>{r.rated ?? "—"}</td>
                        <td>{r.count ?? "—"}</td>
                        <td>
                          {typeof r.average === "number"
                            ? new Intl.NumberFormat("en", {
                                maximumFractionDigits: 2,
                              }).format(r.average)
                            : "Unrated"}
                        </td>
                      </>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
      )}
      <p className="chart-notice" role="status">
        {notice}
      </p>
    </section>
  );
}
