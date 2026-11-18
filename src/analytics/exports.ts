import Papa from "papaparse";
import type { ChartRow } from "./types";
function download(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob),
    a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
const filename = (title: string) =>
  `Kinoquill_${title.replace(/[^a-z0-9]+/gi, "_")}`;
export function exportChartCsv(
  title: string,
  rows: ChartRow[],
  context: string,
) {
  if (!rows.length) throw new Error("There is no chart data to download.");
  const text = Papa.unparse(
    rows.map((row) => ({ ...row, selection: context })),
    { escapeFormulae: true },
  );
  download(
    new Blob(["\uFEFF", text], { type: "text/csv;charset=utf-8" }),
    `${filename(title)}.csv`,
  );
}
/** Recharts uses SVG; rasterize its own local vector output without another library. */
export async function exportChartPng(
  title: string,
  host: HTMLElement,
  context: string,
) {
  const source = host.querySelector(".recharts-wrapper > svg.recharts-surface");
  if (!source) throw new Error("Wait for the chart to finish rendering.");
  const rect = source.getBoundingClientRect();
  if (rect.width < 1 || rect.height < 1)
    throw new Error("The chart is not visible.");
  const width = Math.max(800, Math.ceil(rect.width)),
    height = Math.ceil((rect.height * width) / rect.width);
  const svg = source.cloneNode(true) as SVGSVGElement;
  svg.setAttribute("xmlns", "http://www.w3.org/2000/svg");
  svg.setAttribute("width", String(width));
  svg.setAttribute("height", String(height));
  svg.querySelectorAll("text").forEach((t) => {
    t.setAttribute("fill", "#b9bcc5");
    t.setAttribute("font-family", "Arial, sans-serif");
  });
  const url = URL.createObjectURL(
    new Blob([new XMLSerializer().serializeToString(svg)], {
      type: "image/svg+xml;charset=utf-8",
    }),
  );
  try {
    const image = new Image();
    image.src = url;
    await image.decode();
    const canvas = document.createElement("canvas");
    canvas.width = width * 2;
    canvas.height = (height + 108) * 2;
    const c = canvas.getContext("2d");
    if (!c) throw new Error("Image export is unavailable in this browser.");
    c.scale(2, 2);
    c.fillStyle = "#121620";
    c.fillRect(0, 0, width, height + 108);
    c.fillStyle = "#f3f5f8";
    c.font = "bold 22px Arial";
    c.fillText(title, 24, 35, width - 48);
    c.font = "12px Arial";
    c.fillStyle = "#b9bcc5";
    c.fillText(
      context.length > 120 ? `${context.slice(0, 117)}…` : context,
      24,
      60,
      width - 48,
    );
    c.drawImage(image, 0, 78, width, height);
    let legendX = 24;
    host
      .querySelectorAll<HTMLElement>(".recharts-legend-item-text")
      .forEach((item) => {
        const text = item.textContent ?? "";
        c.fillStyle = getComputedStyle(item).color;
        c.fillRect(legendX, height + 56, 10, 10);
        c.fillText(text, legendX + 16, height + 65);
        legendX += c.measureText(text).width + 40;
      });
    c.fillStyle = "#b9bcc5";
    c.fillText("KINOQUILL · Local library analytics", 24, height + 98);
    const blob = await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob(
        (b) => (b ? resolve(b) : reject(new Error("Could not create image."))),
        "image/png",
      ),
    );
    download(blob, `${filename(title)}.png`);
  } finally {
    URL.revokeObjectURL(url);
  }
}
