import { z } from "zod";
import { dateBounds, isCalendarDate } from "./dates";
import { ValidationError } from "./errors";
import type { LibraryEntry } from "../types/domain";

const name = z.string().trim().min(1, "Please enter a name.");
const nullableText = z.string().trim().nullable().default(null);
const calendar = z
  .string()
  .refine(isCalendarDate, "Please enter a valid calendar date (YYYY-MM-DD).");
const year = z.number().int().min(1).max(9999);
const runtime = z
  .number()
  .finite()
  .positive("Runtime must be positive.")
  .nullable()
  .default(null);
const ids = z
  .array(z.string().min(1))
  .refine(
    (values) => new Set(values).size === values.length,
    "Duplicate associations are not allowed.",
  );
export const dateSchema = z.discriminatedUnion("precision", [
  z.object({ precision: z.literal("unknown"), value: z.null() }).strict(),
  z.object({ precision: z.literal("day"), value: calendar }).strict(),
  z
    .object({
      precision: z.literal("month"),
      value: z.string().regex(/^(?!0000)\d{4}-(0[1-9]|1[0-2])$/),
    })
    .strict(),
  z
    .object({
      precision: z.literal("year"),
      value: z.string().regex(/^(?!0000)\d{4}$/),
    })
    .strict(),
]);
const uncertainDate = dateSchema.default({ precision: "unknown", value: null });
export const watchStatusSchema = z.enum([
  "watchlist",
  "watching",
  "completed",
  "on_hold",
  "dropped",
  "caught_up",
  "unknown",
]);
const rating = z
  .number()
  .finite()
  .min(0, "Rating must be between 0 and 10.")
  .max(10, "Rating must be between 0 and 10.")
  .nullable()
  .default(null);
export const titleCreateSchema = z
  .object({
    title: name,
    originalTitle: nullableText,
    mediaType: z.enum(["movie", "tv"]),
    mediaSubtype: z.enum(["movie", "tv_series", "tv_miniseries"]),
    releaseYear: year.nullable().default(null),
    releaseDate: calendar.nullable().default(null),
    runtimeMinutes: runtime,
    overview: nullableText,
    originalLanguage: nullableText,
    countries: z.array(name).default([]),
    posterPath: nullableText,
    backdropPath: nullableText,
    tmdbId: z.number().int().positive().nullable().default(null),
    imdbId: z
      .string()
      .regex(/^tt\d+$/)
      .nullable()
      .default(null),
    metadataSource: z.enum(["manual", "tmdb", "import"]).default("manual"),
    metadataLastSyncedAt: z.iso.datetime().nullable().default(null),
  })
  .strict()
  .superRefine((value, ctx) => {
    if ((value.mediaType === "movie") !== (value.mediaSubtype === "movie"))
      ctx.addIssue({
        code: "custom",
        path: ["mediaSubtype"],
        message: "Media type and subtype must agree.",
      });
    if (
      value.releaseDate &&
      value.releaseYear !== null &&
      Number(value.releaseDate.slice(0, 4)) !== value.releaseYear
    )
      ctx.addIssue({
        code: "custom",
        path: ["releaseDate"],
        message: "Release year and date must agree.",
      });
  });
export const titleUpdateSchema = z
  .object({
    title: name.optional(),
    originalTitle: nullableText.removeDefault().optional(),
    mediaType: z.enum(["movie", "tv"]).optional(),
    mediaSubtype: z.enum(["movie", "tv_series", "tv_miniseries"]).optional(),
    releaseYear: year.nullable().optional(),
    releaseDate: calendar.nullable().optional(),
    runtimeMinutes: runtime.removeDefault().optional(),
    overview: nullableText.removeDefault().optional(),
    originalLanguage: nullableText.removeDefault().optional(),
    countries: z.array(name).optional(),
    posterPath: nullableText.removeDefault().optional(),
    backdropPath: nullableText.removeDefault().optional(),
    tmdbId: z.number().int().positive().nullable().optional(),
    imdbId: z
      .string()
      .regex(/^tt\d+$/)
      .nullable()
      .optional(),
    metadataSource: z.enum(["manual", "tmdb", "import"]).optional(),
    metadataLastSyncedAt: z.iso.datetime().nullable().optional(),
  })
  .strict();
export type TitleInput = z.input<typeof titleCreateSchema>;
export type TitleUpdate = z.input<typeof titleUpdateSchema>;
export const genreCreateSchema = z.object({ name }).strict();
export const personCreateSchema = genreCreateSchema;
export const categoryCreateSchema = z
  .object({ name, description: nullableText })
  .strict();
export const categoryUpdateSchema = z
  .object({
    name: name.optional(),
    description: nullableText.removeDefault().optional(),
  })
  .strict();
export const personLinkSchema = z
  .object({
    personId: z.string().min(1),
    role: z.enum(["director", "creator"]),
  })
  .strict();
export const associationSchema = z
  .object({
    genreIds: ids.default([]),
    categoryIds: ids.default([]),
    people: z.array(personLinkSchema).default([]),
  })
  .strict()
  .superRefine((value, ctx) => {
    const keys = value.people.map(
      (person) => `${person.personId}:${person.role}`,
    );
    if (new Set(keys).size !== keys.length)
      ctx.addIssue({
        code: "custom",
        path: ["people"],
        message: "Duplicate person associations are not allowed.",
      });
  });
export type Associations = z.input<typeof associationSchema>;
export const libraryBaseSchema = z
  .object({
    status: watchStatusSchema,
    personalRating: rating,
    personalReview: nullableText,
    isFavorite: z.boolean().default(false),
    startedAt: uncertainDate,
    completedAt: uncertainDate,
  })
  .strict()
  .superRefine((value, ctx) => {
    const start = dateBounds(value.startedAt),
      end = dateBounds(value.completedAt);
    if (start && end && start[0] > end[1])
      ctx.addIssue({
        code: "custom",
        path: ["completedAt"],
        message: "Completion cannot precede the start date.",
      });
  });
export const libraryCreateSchema = libraryBaseSchema.superRefine(
  (value, ctx) => {
    if (value.status === "unknown")
      ctx.addIssue({
        code: "custom",
        path: ["status"],
        message: "Unknown status is reserved for historical records.",
      });
    if (value.status === "completed" && value.personalRating === null)
      ctx.addIssue({
        code: "custom",
        path: ["personalRating"],
        message: "Completed titles require a personal rating.",
      });
    if (
      value.personalRating !== null &&
      !Number.isInteger(value.personalRating * 2)
    )
      ctx.addIssue({
        code: "custom",
        path: ["personalRating"],
        message: "Please use half-point rating increments.",
      });
  },
);
export const libraryUpdateSchema = z
  .object({
    status: watchStatusSchema.optional(),
    personalRating: rating.removeDefault().optional(),
    personalReview: nullableText.removeDefault().optional(),
    isFavorite: z.boolean().optional(),
    startedAt: dateSchema.optional(),
    completedAt: dateSchema.optional(),
  })
  .strict();
export type LibraryInput = z.input<typeof libraryCreateSchema>;
export type LibraryUpdate = z.input<typeof libraryUpdateSchema>;
/** Shared editing policy: retain historical precision and incompleteness unchanged. */
export function validateLibraryEdit(
  current: LibraryEntry,
  input: LibraryUpdate,
) {
  const patch = validate(libraryUpdateSchema, input);
  const fields = {
    status: current.status,
    personalRating: current.personalRating,
    personalReview: current.personalReview,
    isFavorite: current.isFavorite,
    startedAt: current.startedAt,
    completedAt: current.completedAt,
  };
  const values = validate(libraryBaseSchema, { ...fields, ...patch });
  if (
    values.personalRating !== null &&
    (current.ratingPolicy === "manual" ||
      values.personalRating !== current.personalRating) &&
    !Number.isInteger(values.personalRating * 2)
  )
    throw new ValidationError(
      "Please use half-point rating increments for new ratings. Historical ratings are preserved when unchanged.",
    );
  if (values.status === "unknown" && current.status !== "unknown")
    throw new ValidationError(
      "Unknown status is reserved for historical records.",
    );
  if (
    values.status === "completed" &&
    values.personalRating === null &&
    !(
      current.ratingPolicy === "historical" &&
      current.status === "completed" &&
      current.personalRating === null
    )
  )
    throw new ValidationError("Completed titles require a personal rating.");
  return values;
}
export const viewingCreateSchema = z
  .object({
    libraryEntryId: z.string().min(1),
    sessionType: z.enum(["first_watch", "rewatch"]),
    viewedDate: uncertainDate,
    durationMinutes: z.number().finite().nonnegative().nullable().default(null),
    notes: nullableText,
    episodeId: z.string().min(1).nullable().default(null),
    sessionRating: rating.default(null),
    platform: nullableText,
    context: nullableText,
  })
  .strict();
export const seasonCreateSchema = z
  .object({
    titleId: z.string().min(1),
    seasonNumber: z.number().int().nonnegative(),
    name: nullableText,
    episodeCount: z.number().int().nonnegative().nullable().default(null),
    releaseDate: calendar.nullable().default(null),
  })
  .strict();
export const episodeCreateSchema = z
  .object({
    seasonId: z.string().min(1),
    episodeNumber: z.number().int().positive(),
    name: nullableText,
    runtimeMinutes: runtime,
    airDate: calendar.nullable().default(null),
  })
  .strict();
export const seasonUpdateSchema = z
  .object({
    seasonNumber: z.number().int().nonnegative().optional(),
    name: nullableText.removeDefault().optional(),
    episodeCount: z.number().int().nonnegative().nullable().optional(),
    releaseDate: calendar.nullable().optional(),
  })
  .strict();
export const episodeUpdateSchema = z
  .object({
    episodeNumber: z.number().int().positive().optional(),
    name: nullableText.removeDefault().optional(),
    runtimeMinutes: runtime.removeDefault().optional(),
    airDate: calendar.nullable().optional(),
  })
  .strict();
export const progressUpdateSchema = z
  .object({
    libraryEntryId: z.string().min(1),
    episodeId: z.string().min(1),
    watched: z.boolean(),
    watchedAt: uncertainDate,
  })
  .strict()
  .refine(
    (value) => value.watched || value.watchedAt.precision === "unknown",
    "Unwatched episodes cannot have a watched date.",
  );
export function validate<S extends z.ZodType>(
  schema: S,
  input: unknown,
): z.output<S> {
  const result = schema.safeParse(input);
  if (!result.success)
    throw new ValidationError(
      result.error.issues
        .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
        .join("\n"),
    );
  // Omitted/undefined patch fields preserve stored values; only explicit null clears.
  if (
    result.data !== null &&
    typeof result.data === "object" &&
    !Array.isArray(result.data)
  )
    return Object.fromEntries(
      Object.entries(result.data).filter(([, value]) => value !== undefined),
    ) as z.output<S>;
  return result.data;
}
