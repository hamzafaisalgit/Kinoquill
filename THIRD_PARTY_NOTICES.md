# Phase 7 spreadsheet dependencies

- **ExcelJS 4.4.0**, MIT: [project and license](https://github.com/exceljs/exceljs). Used for local XLSX reading/writing; the official browser build is loaded on demand. Formulas are not evaluated.
- **Papa Parse**, MIT: [project and license](https://github.com/mholt/PapaParse), [CSV options](https://www.papaparse.com/docs). Used for local CSV parsing and generation. Export additionally protects formula-like text and marks Kinoquill CSVs for explicit round-trip decoding.
- **@types/papaparse**, MIT: [DefinitelyTyped](https://github.com/DefinitelyTyped/DefinitelyTyped/tree/master/types/papaparse). Development-only TypeScript declarations.

Installed versions and transitive dependencies are pinned in `package-lock.json`; upstream license files remain in their packages. No spreadsheet-processing server or remote file API is used. The current dependency audit limitations are documented in README.md.
