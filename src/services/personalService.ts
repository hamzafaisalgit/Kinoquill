import { z } from "zod";
import type { KinoquillDatabase } from "../db/database";
import type { SavedView } from "../types/personal";
import type { LibraryPreferences } from "../utils/libraryState";
import {
  FILTER_KEYS,
  SORTS,
  COLUMNS,
  libraryPreferences,
} from "../utils/libraryState";
import { normalizeName, newId, now } from "../utils/normalization";
import { validate } from "../utils/validation";
import { required, write } from "./domainSupport";
import { ConflictError, ValidationError } from "../utils/errors";
import { isCalendarDate } from "../utils/dates";
import { STATUSES } from "../utils/libraryState";
function validViewParams(value: string) {
  const p = new URLSearchParams(value);
  if (
    ![...p].every(
      ([key, v]) =>
        [...FILTER_KEYS, "sort", "view", "size"].includes(key) &&
        v.length <= 1000,
    )
  )
    return false;
  for (const [low, high, min, max] of [
    ["minRating", "maxRating", 0, 10],
    ["minYear", "maxYear", 1, 9999],
  ] as const) {
    for (const key of [low, high]) {
      const v = p.get(key);
      if (
        v !== null &&
        v !== "" &&
        (!Number.isFinite(Number(v)) ||
          Number(v) < min ||
          Number(v) > max ||
          (min === 1 && !Number.isInteger(Number(v))))
      )
        return false;
    }
    if (p.get(low) && p.get(high) && Number(p.get(low)) > Number(p.get(high)))
      return false;
  }
  for (const [from, to] of [
    ["watchedFrom", "watchedTo"],
    ["addedFrom", "addedTo"],
  ]) {
    const a = p.get(from),
      b = p.get(to);
    if (
      (a && !isCalendarDate(a)) ||
      (b && !isCalendarDate(b)) ||
      (a && b && a > b)
    )
      return false;
  }
  const enums: Record<string, string[]> = {
    type: ["movie", "tv", "tv_miniseries"],
    status: STATUSES.map((s) => s.value),
    sort: SORTS.map((s) => s.value),
    view: ["grid", "table"],
    size: ["12", "24", "48"],
    genreMatch: ["any", "all"],
    categoryMatch: ["any", "all"],
    unrated: ["1"],
    favorite: ["1"],
  };
  return Object.entries(enums).every(
    ([key, values]) => !p.has(key) || values.includes(p.get(key)!),
  );
}
export const namedSchema = z
  .object({
    name: z.string().trim().min(1).max(200),
    description: z.string().max(5000).nullable().default(null),
  })
  .strict();
export const displaySchema = z
  .object({
    view: z.enum(["grid", "table"]),
    sort: z.enum(SORTS.map((s) => s.value)),
    columns: z
      .array(z.enum(COLUMNS.map((c) => c[0])))
      .refine(
        (v) => new Set(v).size === v.length && v.includes("title"),
        "Columns must be unique and include title.",
      ),
  })
  .strict();
export const savedConfigSchema = z
  .object({
    route: z.enum([
      "/library",
      "/movies",
      "/shows",
      "/watchlist",
      "/favorites",
    ]),
    params: z
      .string()
      .max(20000)
      .refine(validViewParams, "Invalid saved filter configuration"),
    display: displaySchema,
  })
  .strict();
export type DiaryQuery = {
  media?: string;
  kind?: string;
  from?: string;
  to?: string;
  categoryId?: string;
  sort?: "newest" | "oldest";
  page?: number;
};
export class PersonalService {
  private readonly db: KinoquillDatabase;
  constructor(db: KinoquillDatabase) {
    this.db = db;
  }
  lists() {
    return this.db.customLists.orderBy("name").toArray();
  }
  listCards() {
    return this.db.transaction(
      "r",
      [this.db.customLists, this.db.listItems, this.db.titles],
      async () => {
        const [lists, items, titles] = await Promise.all([
          this.lists(),
          this.db.listItems.toArray(),
          this.db.titles.toArray(),
        ]);
        const map = new Map(titles.map((t) => [t.id, t]));
        return lists.map((list) => {
          const rows = items
            .filter((i) => i.listId === list.id)
            .sort((a, b) => a.position - b.position);
          return {
            list,
            count: rows.length,
            covers: rows.slice(0, 3).flatMap((i) => map.get(i.titleId) ?? []),
          };
        });
      },
    );
  }
  createList(input: z.input<typeof namedSchema>) {
    const v = validate(namedSchema, input);
    return write(this.db, async () => {
      const row = { ...v, id: newId(), createdAt: now(), updatedAt: now() };
      await this.db.customLists.add(row);
      return row;
    });
  }
  createListWithTitles(input: z.input<typeof namedSchema>, titleIds: string[]) {
    return write(this.db, async () => {
      const list = await this.createList(input);
      const result = await this.addToList(list.id, titleIds);
      return { list, ...result };
    });
  }
  updateList(id: string, input: z.input<typeof namedSchema>) {
    const v = validate(namedSchema, input);
    return write(this.db, async () => {
      const old = await required(this.db.customLists, id, "List");
      const row = { ...old, ...v, updatedAt: now() };
      await this.db.customLists.put(row);
      return row;
    });
  }
  deleteList(id: string) {
    return write(this.db, async () => {
      await required(this.db.customLists, id, "List");
      await this.db.listItems.where("listId").equals(id).delete();
      await this.db.customLists.delete(id);
    });
  }
  async addToList(listId: string, titleIds: string[]) {
    if (!titleIds.length || titleIds.length > 5000)
      throw new ValidationError("Select between 1 and 5,000 titles.");
    return write(this.db, async () => {
      const list = await required(this.db.customLists, listId, "List");
      const existing = await this.db.listItems
        .where("listId")
        .equals(listId)
        .toArray();
      const present = new Set(existing.map((i) => i.titleId));
      let position = existing.reduce((n, i) => Math.max(n, i.position + 1), 0),
        added = 0;
      for (const titleId of new Set(titleIds)) {
        const entry = await this.db.libraryEntries
          .where("titleId")
          .equals(titleId)
          .first();
        if (!entry || entry.deletedAt)
          throw new ValidationError(
            "Restore archived titles before adding them to a list.",
          );
        if (!present.has(titleId)) {
          await this.db.listItems.add({
            id: newId(),
            listId,
            titleId,
            position: position++,
            createdAt: now(),
          });
          added++;
        }
      }
      await this.db.customLists.put({ ...list, updatedAt: now() });
      return { added, alreadyPresent: new Set(titleIds).size - added };
    });
  }
  removeFromList(listId: string, itemId: string) {
    return write(this.db, async () => {
      const row = await required(this.db.listItems, itemId, "List item");
      if (row.listId !== listId)
        throw new ValidationError("This item belongs to another list.");
      await this.db.listItems.delete(itemId);
    });
  }
  reorder(listId: string, orderedIds: string[]) {
    return write(this.db, async () => {
      const list = await required(this.db.customLists, listId, "List");
      const rows = await this.db.listItems
        .where("listId")
        .equals(listId)
        .toArray();
      if (
        rows.length !== orderedIds.length ||
        new Set(orderedIds).size !== rows.length ||
        rows.some((r) => !orderedIds.includes(r.id))
      )
        throw new ConflictError(
          "List contents changed. Refresh before reordering.",
        );
      const byId = new Map(rows.map((r) => [r.id, r]));
      await this.db.listItems.bulkPut(
        orderedIds.map((id, position) => ({ ...byId.get(id)!, position })),
      );
      await this.db.customLists.put({ ...list, updatedAt: now() });
    });
  }
  async listDetails(id: string) {
    return this.db.transaction(
      "r",
      [
        this.db.customLists,
        this.db.listItems,
        this.db.titles,
        this.db.libraryEntries,
      ],
      async () => {
        const list = await required(this.db.customLists, id, "List");
        const rows = (
          await this.db.listItems.where("listId").equals(id).toArray()
        ).sort((a, b) => a.position - b.position || a.id.localeCompare(b.id));
        const titles = await this.db.titles.bulkGet(rows.map((r) => r.titleId));
        const entries = new Map(
          (await this.db.libraryEntries.toArray()).map((e) => [e.titleId, e]),
        );
        return {
          list,
          items: rows.map((row, i) => ({
            row,
            title: titles[i],
            entry: entries.get(row.titleId),
          })),
        };
      },
    );
  }
  tags() {
    return this.db.tags.orderBy("normalizedName").toArray();
  }
  saveTag(name: string, id?: string) {
    name = validate(z.string().trim().min(1).max(100), name);
    return write(this.db, async () => {
      const existing = id ? await required(this.db.tags, id, "Tag") : null;
      const normalizedName = normalizeName(name);
      const duplicate = await this.db.tags
        .where("normalizedName")
        .equals(normalizedName)
        .first();
      if (duplicate && duplicate.id !== id)
        throw new ConflictError("A tag with this name already exists.");
      const row = {
        id: id ?? newId(),
        name,
        normalizedName,
        createdAt: existing?.createdAt ?? now(),
        updatedAt: now(),
      };
      await this.db.tags.put(row);
      return row;
    });
  }
  deleteTag(id: string) {
    return write(this.db, async () => {
      await this.db.titleTags.where("tagId").equals(id).delete();
      await this.db.tags.delete(id);
    });
  }
  setTag(titleId: string, tagId: string, assigned: boolean) {
    return write(this.db, async () => {
      await required(this.db.tags, tagId, "Tag");
      await required(this.db.titles, titleId, "Title");
      const entry = await this.db.libraryEntries
        .where("titleId")
        .equals(titleId)
        .first();
      if (!entry || entry.deletedAt)
        throw new ValidationError("Restore this title before editing tags.");
      if (assigned) await this.db.titleTags.put({ titleId, tagId });
      else await this.db.titleTags.delete([titleId, tagId]);
    });
  }
  titleTags(titleId: string) {
    return this.db.titleTags.where("titleId").equals(titleId).toArray();
  }
  views() {
    return this.db.savedViews.orderBy("name").toArray();
  }
  saveView(
    input: z.input<typeof namedSchema> & {
      route: SavedView["route"];
      params: string;
      display: LibraryPreferences;
    },
    id?: string,
  ) {
    const named = validate(namedSchema, {
      name: input.name,
      description: input.description,
    });
    const config = validate(savedConfigSchema, {
      route: input.route,
      params: input.params,
      display: input.display,
    });
    return write(this.db, async () => {
      const old = id
        ? await required(this.db.savedViews, id, "Saved view")
        : null;
      const row: SavedView = {
        ...named,
        ...config,
        id: id ?? newId(),
        createdAt: old?.createdAt ?? now(),
        updatedAt: now(),
      };
      await this.db.savedViews.put(row);
      return row;
    });
  }
  deleteView(id: string) {
    return this.db.savedViews.delete(id);
  }
  async inspectView(view: SavedView) {
    const p = new URLSearchParams(view.params);
    const missing: string[] = [];
    for (const [key, table] of [
      ["genre", this.db.genres],
      ["category", this.db.categories],
      ["tag", this.db.tags],
    ] as const) {
      for (const id of p.getAll(key))
        if (!(await table.get(id))) {
          missing.push(key);
          p.delete(key, id);
        }
    }
    return {
      missing,
      params: p.toString(),
      display: libraryPreferences(view.display),
    };
  }
}
