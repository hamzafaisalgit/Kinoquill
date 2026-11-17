import type { KinoquillDatabase } from "../db/database";
import type {
  DuplicateMatch,
  MediaType,
  PaginatedResult,
  Title,
} from "../types/domain";
import { normalizeName, newId, now } from "../utils/normalization";
import { DuplicateTitleError, ConflictError } from "../utils/errors";
import {
  titleCreateSchema,
  titleUpdateSchema,
  validate,
} from "../utils/validation";
import type { TitleInput, TitleUpdate } from "../utils/validation";
import { required, write } from "./domainSupport";

export class TitleService {
  constructor(privateDatabase: KinoquillDatabase) {
    this.db = privateDatabase;
  }
  private readonly db: KinoquillDatabase;

  async findDuplicates(
    input: Pick<Title, "title" | "mediaType"> &
      Partial<Pick<Title, "releaseYear" | "tmdbId" | "imdbId">>,
    excludeId?: string,
  ): Promise<DuplicateMatch[]> {
    const matches = new Map<string, DuplicateMatch>();
    for (const [field, value] of [
      ["tmdbId", input.tmdbId],
      ["imdbId", input.imdbId],
    ] as const) {
      if (value !== null && value !== undefined) {
        const title = await this.db.titles
          .where(`[mediaType+${field}]`)
          .equals([input.mediaType, value])
          .first();
        if (title && title.id !== excludeId)
          matches.set(title.id, {
            strength: "strong",
            reason: `Identical ${field} in the ${input.mediaType} namespace.`,
            title,
          });
      }
    }
    const candidates = await this.db.titles
      .where("[mediaType+normalizedTitle]")
      .equals([input.mediaType, normalizeName(input.title)])
      .toArray();
    for (const title of candidates) {
      if (
        title.id !== excludeId &&
        !matches.has(title.id) &&
        (input.releaseYear == null ||
          title.releaseYear === null ||
          title.releaseYear === input.releaseYear)
      )
        matches.set(title.id, {
          strength: "possible",
          reason: "Matching normalized title and compatible release year.",
          title,
        });
    }
    return [...matches.values()];
  }

  async createTitle(
    input: TitleInput,
    options: { confirmPossibleDuplicate?: boolean } = {},
  ): Promise<Title> {
    const values = validate(titleCreateSchema, input);
    return write(this.db, async () => {
      const matches = await this.findDuplicates(values);
      if (
        matches.some((match) => match.strength === "strong") ||
        (matches.length && !options.confirmPossibleDuplicate)
      )
        throw new DuplicateTitleError(matches);
      const timestamp = now();
      const title: Title = {
        ...values,
        id: newId(),
        normalizedTitle: normalizeName(values.title),
        createdAt: timestamp,
        updatedAt: timestamp,
        revision: 1,
      };
      await this.db.titles.add(title);
      return title;
    });
  }

  getTitleById(id: string) {
    return required(this.db.titles, id, "Title");
  }

  async updateTitle(
    id: string,
    patch: TitleUpdate,
    options: {
      expectedRevision?: number;
      confirmPossibleDuplicate?: boolean;
    } = {},
  ): Promise<Title> {
    const changes = validate(titleUpdateSchema, patch);
    return write(this.db, async () => {
      const current = await this.getTitleById(id);
      if (
        options.expectedRevision !== undefined &&
        current.revision !== options.expectedRevision
      )
        throw new ConflictError(
          "This title changed in another view. Reload it before saving.",
        );
      const {
        id: _id,
        normalizedTitle: _normalized,
        createdAt: _created,
        updatedAt: _updated,
        revision: _revision,
        ...fields
      } = current;
      void _id;
      void _normalized;
      void _created;
      void _updated;
      void _revision;
      const values = validate(titleCreateSchema, { ...fields, ...changes });
      if (values.mediaType !== current.mediaType)
        throw new ConflictError(
          "A title’s media type cannot be changed. Create the correct production separately.",
        );
      const identityChanged =
        normalizeName(values.title) !== current.normalizedTitle ||
        values.releaseYear !== current.releaseYear ||
        values.tmdbId !== current.tmdbId ||
        values.imdbId !== current.imdbId;
      const matches = identityChanged
        ? await this.findDuplicates(values, id)
        : [];
      if (
        matches.some((match) => match.strength === "strong") ||
        (matches.length && !options.confirmPossibleDuplicate)
      )
        throw new DuplicateTitleError(matches);
      const title = {
        ...current,
        ...values,
        normalizedTitle: normalizeName(values.title),
        updatedAt: now(),
        revision: current.revision + 1,
      };
      await this.db.titles.put(title);
      return title;
    });
  }

  async listTitles(
    query: {
      search?: string;
      mediaType?: MediaType;
      page?: number;
      pageSize?: number;
    } = {},
  ): Promise<PaginatedResult<Title>> {
    const { page, pageSize } = pagination(query);
    const collection = query.mediaType
      ? this.db.titles.where("mediaType").equals(query.mediaType)
      : this.db.titles.toCollection();
    const search = normalizeName(query.search ?? "");
    const records = (
      await collection
        .filter((title) => title.normalizedTitle.includes(search))
        .toArray()
    ).sort(
      (a, b) =>
        a.normalizedTitle.localeCompare(b.normalizedTitle) ||
        a.id.localeCompare(b.id),
    );
    return paginate(records, page, pageSize);
  }
}

export function pagination(query: { page?: number; pageSize?: number }) {
  const page = query.page ?? 1,
    pageSize = query.pageSize ?? 24;
  if (
    !Number.isInteger(page) ||
    page < 1 ||
    !Number.isInteger(pageSize) ||
    pageSize < 1 ||
    pageSize > 200
  )
    throw new ConflictError(
      "Use a positive page number and a page size from 1 to 200.",
    );
  return { page, pageSize };
}
export function paginate<T>(
  records: T[],
  page: number,
  pageSize: number,
): PaginatedResult<T> {
  return {
    items: records.slice((page - 1) * pageSize, page * pageSize),
    total: records.length,
    page,
    pageSize,
    totalPages: Math.ceil(records.length / pageSize),
  };
}
