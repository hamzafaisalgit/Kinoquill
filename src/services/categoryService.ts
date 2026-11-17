import type { KinoquillDatabase } from "../db/database";
import {
  categoryCreateSchema,
  categoryUpdateSchema,
  validate,
} from "../utils/validation";
import { newId, normalizeName, now } from "../utils/normalization";
import { activeEntry, required, write } from "./domainSupport";
import { ConflictError } from "../utils/errors";

export class CategoryService {
  private readonly db: KinoquillDatabase;
  constructor(db: KinoquillDatabase) {
    this.db = db;
  }
  async createCategory(input: { name: string; description?: string | null }) {
    const values = validate(categoryCreateSchema, input);
    return write(this.db, async () => {
      const normalizedName = normalizeName(values.name);
      if (
        await this.db.categories
          .where("normalizedName")
          .equals(normalizedName)
          .first()
      )
        throw new ConflictError("A category with this name already exists.");
      const category = {
        ...values,
        id: newId(),
        normalizedName,
        createdAt: now(),
        updatedAt: now(),
      };
      await this.db.categories.add(category);
      return category;
    });
  }
  getCategory(id: string) {
    return required(this.db.categories, id, "Category");
  }
  listCategories() {
    return this.db.categories.orderBy("normalizedName").toArray();
  }
  async listWithUsage() {
    return this.db.transaction(
      "r",
      [this.db.categories, this.db.libraryEntries, this.db.libraryCategories],
      async () => {
        const categories = await this.listCategories(),
          active = new Set(
            await this.db.libraryEntries
              .filter((entry) => entry.deletedAt === null)
              .primaryKeys(),
          ),
          links = await this.db.libraryCategories.toArray();
        return categories.map((category) => ({
          ...category,
          count: links.filter(
            (link) =>
              link.categoryId === category.id &&
              active.has(link.libraryEntryId),
          ).length,
        }));
      },
    );
  }
  private async touchEntries(ids: string[]) {
    for (const id of new Set(ids)) {
      const entry = await this.db.libraryEntries.get(id);
      if (entry)
        await this.db.libraryEntries.update(id, {
          revision: entry.revision + 1,
          updatedAt: now(),
        });
    }
  }
  async getEntryCategories(libraryEntryId: string) {
    return this.db.transaction(
      "r",
      [this.db.libraryEntries, this.db.libraryCategories, this.db.categories],
      async () => {
        await activeEntry(this.db, libraryEntryId);
        const links = await this.db.libraryCategories
          .where("libraryEntryId")
          .equals(libraryEntryId)
          .toArray();
        return Promise.all(
          links.map((link) => this.getCategory(link.categoryId)),
        );
      },
    );
  }
  async updateCategory(
    id: string,
    input: { name?: string; description?: string | null },
  ) {
    const patch = validate(categoryUpdateSchema, input);
    return write(this.db, async () => {
      const values = { ...(await this.getCategory(id)), ...patch };
      const normalizedName = normalizeName(values.name);
      const duplicate = await this.db.categories
        .where("normalizedName")
        .equals(normalizedName)
        .first();
      if (duplicate && duplicate.id !== id)
        throw new ConflictError("A category with this name already exists.");
      const category = { ...values, normalizedName, updatedAt: now() };
      await this.db.categories.put(category);
      await this.touchEntries(
        (
          await this.db.libraryCategories
            .where("categoryId")
            .equals(id)
            .toArray()
        ).map((link) => link.libraryEntryId),
      );
      return category;
    });
  }
  deleteCategory(id: string) {
    return write(this.db, async () => {
      await this.getCategory(id);
      await this.touchEntries(
        (
          await this.db.libraryCategories
            .where("categoryId")
            .equals(id)
            .toArray()
        ).map((link) => link.libraryEntryId),
      );
      await this.db.libraryCategories.where("categoryId").equals(id).delete();
      await this.db.categories.delete(id);
    });
  }
  addCategory(libraryEntryId: string, categoryId: string) {
    return write(this.db, async () => {
      await activeEntry(this.db, libraryEntryId);
      await this.getCategory(categoryId);
      if (await this.db.libraryCategories.get([libraryEntryId, categoryId]))
        throw new ConflictError("This category is already attached.");
      await this.db.libraryCategories.add({ libraryEntryId, categoryId });
      await this.touchEntries([libraryEntryId]);
    });
  }
  removeCategory(libraryEntryId: string, categoryId: string) {
    return write(this.db, async () => {
      await activeEntry(this.db, libraryEntryId);
      await this.getCategory(categoryId);
      await this.db.libraryCategories.delete([libraryEntryId, categoryId]);
      await this.touchEntries([libraryEntryId]);
    });
  }
}
