import type { DuplicateMatch } from "../types/domain";

export class ValidationError extends Error {
  name = "ValidationError";
}
export class RecordNotFoundError extends Error {
  name = "RecordNotFoundError";
}
export class ReferentialIntegrityError extends Error {
  name = "ReferentialIntegrityError";
}
export class ConflictError extends Error {
  name = "ConflictError";
}
export class StorageUnavailableError extends Error {
  name = "StorageUnavailableError";
}
export class DuplicateTitleError extends ConflictError {
  name = "DuplicateTitleError";
  readonly matches: DuplicateMatch[];
  constructor(matches: DuplicateMatch[]) {
    super(
      "This production may already exist. Review the duplicate matches before continuing.",
    );
    this.matches = matches;
  }
}
