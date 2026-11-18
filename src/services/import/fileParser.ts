import Papa from "papaparse";
import type { Cell, ParsedFile, ParsedSheet } from "../../types/imports";
import { ValidationError } from "../../utils/errors";
export const MAX_FILE_BYTES = 10 * 1024 * 1024,
  MAX_IMPORT_ROWS = 5000,
  MAX_COLUMNS = 100;
export async function excelModule() {
  const module = await import("exceljs");
  return module.default ?? module;
}
function checkWorkbookContainer(buffer: ArrayBuffer) {
  const view = new DataView(buffer),
    bytes = new Uint8Array(buffer);
  let end = -1;
  for (
    let index = buffer.byteLength - 22;
    index >= Math.max(0, buffer.byteLength - 65557);
    index--
  )
    if (view.getUint32(index, true) === 0x06054b50) {
      end = index;
      break;
    }
  if (end < 0)
    throw new ValidationError(
      "The file is not a readable XLSX ZIP container. Resave it as .xlsx.",
    );
  const entries = view.getUint16(end + 10, true);
  let offset = view.getUint32(end + 16, true),
    expanded = 0;
  if (entries > 4096)
    throw new ValidationError(
      "This workbook has too many internal parts. Use a smaller standard XLSX file.",
    );
  for (let index = 0; index < entries; index++) {
    if (
      offset + 46 > buffer.byteLength ||
      view.getUint32(offset, true) !== 0x02014b50
    )
      throw new ValidationError(
        "This workbook container is malformed or uses unsupported ZIP64 storage.",
      );
    const size = view.getUint32(offset + 24, true),
      nameLength = view.getUint16(offset + 28, true),
      extra = view.getUint16(offset + 30, true),
      comment = view.getUint16(offset + 32, true);
    expanded += size;
    if (expanded > 80 * 1024 * 1024)
      throw new ValidationError(
        "This workbook expands beyond the 80 MB processing limit. Split or simplify it first.",
      );
    const name = new TextDecoder().decode(
      bytes.subarray(offset + 46, offset + 46 + nameLength),
    );
    if (/vbaProject\.bin$/i.test(name))
      throw new ValidationError(
        "Macro-containing workbooks are not supported. Save a macro-free .xlsx copy.",
      );
    offset += 46 + nameLength + extra + comment;
  }
}
export function parseCsv(text: string): ParsedSheet {
  if (text.includes("\0"))
    throw new ValidationError("This is not a readable UTF-8 CSV file.");
  const parsed = Papa.parse<string[]>(text.replace(/^\uFEFF/, ""), {
    delimiter: ",",
    skipEmptyLines: false,
    dynamicTyping: false,
  });
  if (parsed.errors.length)
    throw new ValidationError(
      `CSV could not be read: ${parsed.errors[0].message}. Check quotations and separators.`,
    );
  const rows = parsed.data
    .map((cells, index) => ({
      number: index + 1,
      cells: cells.map((cell) => (cell === "" ? null : cell)),
    }))
    .filter((row) =>
      row.cells.some((value) => value !== null && String(value).trim() !== ""),
    );
  return { name: "Collection", rows, notices: [] };
}
export async function parseFile(
  file: Pick<File, "name" | "size" | "arrayBuffer" | "text">,
): Promise<ParsedFile> {
  const type = file.name.toLowerCase().endsWith(".csv")
    ? "csv"
    : file.name.toLowerCase().endsWith(".xlsx")
      ? "xlsx"
      : null;
  if (!type)
    throw new ValidationError(
      "Choose a .csv or .xlsx file. Legacy .xls and macro-enabled files are not supported.",
    );
  if (!file.size) throw new ValidationError("This file is empty.");
  if (file.size > MAX_FILE_BYTES)
    throw new ValidationError(
      "Choose a file no larger than 10 MB. Split larger collections into smaller files.",
    );
  let sheets: ParsedSheet[];
  if (type === "csv") sheets = [parseCsv(await file.text())];
  else {
    try {
      const Excel = await excelModule(),
        workbook = new Excel.Workbook(),
        buffer = await file.arrayBuffer();
      checkWorkbookContainer(buffer);
      await workbook.xlsx.load(buffer);
      if (workbook.worksheets.length > 50)
        throw new ValidationError(
          "Use a workbook with no more than 50 sheets.",
        );
      sheets = workbook.worksheets.map((sheet) => {
        const rows: ParsedSheet["rows"] = [],
          notices = new Set<string>();
        sheet.eachRow({ includeEmpty: false }, (row) => {
          if (row.number > MAX_IMPORT_ROWS + 100)
            throw new ValidationError(
              "A sheet extends beyond 5,100 rows. Remove unused distant cells and split large collections.",
            );
          const cells: Cell[] = [];
          row.eachCell({ includeEmpty: false }, (cell, column) => {
            if (column > MAX_COLUMNS)
              throw new ValidationError(
                "A sheet has more than 100 populated columns. Remove unused distant cells.",
              );
            const value = cell.value;
            if (value instanceof Date) {
              if (Number.isNaN(value.getTime()))
                throw new ValidationError(
                  "A workbook contains an invalid date.",
                );
              cells[column - 1] = value.toISOString().slice(0, 10);
            } else if (value && typeof value === "object") {
              if ("formula" in value || "sharedFormula" in value) {
                notices.add(
                  "Formula cells use cached results only; no formulas are executed. Missing cached results read as empty.",
                );
                const result = "result" in value ? value.result : null;
                cells[column - 1] =
                  typeof result === "number" ||
                  typeof result === "string" ||
                  typeof result === "boolean"
                    ? result
                    : result instanceof Date
                      ? result.toISOString().slice(0, 10)
                      : null;
              } else if ("richText" in value)
                cells[column - 1] = value.richText
                  .map((part) => part.text)
                  .join("");
              else if ("text" in value) cells[column - 1] = value.text;
              else {
                notices.add(
                  "Unsupported/error cells read as empty. Review mapped values.",
                );
                cells[column - 1] = null;
              }
            } else cells[column - 1] = value ?? null;
          });
          if (
            cells.some(
              (value) =>
                value !== null &&
                value !== undefined &&
                String(value).trim() !== "",
            )
          )
            rows.push({
              number: row.number,
              cells: Array.from(cells, (value) => value ?? null),
            });
        });
        return { name: sheet.name, rows, notices: [...notices] };
      });
    } catch (error) {
      if (error instanceof ValidationError) throw error;
      throw new ValidationError(
        "This workbook could not be read. Use an unencrypted .xlsx file; resave corrupted or legacy files in Excel first.",
      );
    }
  }
  if (!sheets.some((sheet) => sheet.rows.length > 1))
    throw new ValidationError(
      "No data rows were found. Include a header row and at least one record.",
    );
  if (
    sheets.some((sheet) =>
      sheet.rows.some((row) => row.cells.length > MAX_COLUMNS),
    )
  )
    throw new ValidationError(
      "Files may contain at most 100 populated columns.",
    );
  if (
    sheets
      .filter(
        (sheet) => !["Instructions", "Export Information"].includes(sheet.name),
      )
      .reduce((sum, sheet) => sum + Math.max(0, sheet.rows.length - 1), 0) >
    MAX_IMPORT_ROWS
  )
    throw new ValidationError(
      "This file exceeds 5,000 data rows. Split it into smaller files; nothing was truncated or saved.",
    );
  return { name: file.name, size: file.size, type, sheets };
}
