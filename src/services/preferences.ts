import { z } from "zod";
import { JOURNAL_DEFAULTS } from "../types/personal";
import { displaySchema } from "./personalService";
export const journalSchema = z
  .object({
    pageSize: z.union([z.literal(12), z.literal(24), z.literal(48)]),
    showCardYear: z.boolean(),
    showCardRating: z.boolean(),
    posters: z.boolean(),
    reducedMotion: z.boolean(),
    expandSeasons: z.boolean(),
    includeSpecials: z.boolean(),
    progressStyle: z.enum(["bar", "numbers"]),
    backupInterval: z.union([
      z.literal(0),
      z.literal(7),
      z.literal(30),
      z.literal(90),
    ]),
    lastBackupAt: z.iso.datetime().nullable(),
    remindAfter: z.iso.datetime().nullable(),
  })
  .strict();
export const settingsSchema = z
  .object({
    id: z.literal("preferences"),
    sidebarCollapsed: z.boolean(),
    library: displaySchema.optional(),
    journal: journalSchema.optional(),
  })
  .strict();
export function journalPreferences(value: unknown) {
  const result = journalSchema.safeParse(value);
  return result.success ? result.data : { ...JOURNAL_DEFAULTS };
}
