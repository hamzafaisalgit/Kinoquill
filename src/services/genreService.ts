import type { KinoquillDatabase } from "../db/database";
import {
  associationSchema,
  genreCreateSchema,
  validate,
} from "../utils/validation";
import { ConflictError } from "../utils/errors";
import { newId, normalizeName, now } from "../utils/normalization";
import { required, write, refreshReviewFlags } from "./domainSupport";

export class GenreService {
  private readonly db: KinoquillDatabase;
  constructor(db: KinoquillDatabase) {
    this.db = db;
  }
  async createGenre(input: { name: string }) {
    const { name } = validate(genreCreateSchema, input);
    return write(this.db, async () => {
      const normalizedName = normalizeName(name);
      if (
        await this.db.genres
          .where("normalizedName")
          .equals(normalizedName)
          .first()
      )
        throw new ConflictError("A genre with this name already exists.");
      const genre = { id: newId(), name, normalizedName, createdAt: now() };
      await this.db.genres.add(genre);
      return genre;
    });
  }
  getGenre(id: string) {
    return required(this.db.genres, id, "Genre");
  }
  async updateGenre(id: string, input: { name: string }) {
    const { name } = validate(genreCreateSchema, input);
    return write(this.db, async () => {
      const genre = await this.getGenre(id);
      const normalizedName = normalizeName(name);
      const duplicate = await this.db.genres
        .where("normalizedName")
        .equals(normalizedName)
        .first();
      if (duplicate && duplicate.id !== id)
        throw new ConflictError("A genre with this name already exists.");
      const updated = { ...genre, name, normalizedName };
      await this.db.genres.put(updated);
      return updated;
    });
  }
  listGenres() {
    return this.db.genres.orderBy("normalizedName").toArray();
  }
  async getTitleGenres(titleId: string) {
    return this.db.transaction(
      "r",
      [this.db.titles, this.db.titleGenres, this.db.genres],
      async () => {
        await required(this.db.titles, titleId, "Title");
        const links = await this.db.titleGenres
          .where("titleId")
          .equals(titleId)
          .toArray();
        return Promise.all(links.map((link) => this.getGenre(link.genreId)));
      },
    );
  }
  async assignGenres(titleId: string, inputGenreIds: string[]) {
    const { genreIds } = validate(associationSchema, {
      genreIds: inputGenreIds,
    });
    return write(this.db, async () => {
      await required(this.db.titles, titleId, "Title");
      for (const id of genreIds) await this.getGenre(id);
      await this.db.titleGenres.where("titleId").equals(titleId).delete();
      await this.db.titleGenres.bulkAdd(
        genreIds.map((genreId) => ({ titleId, genreId })),
      );
      await refreshReviewFlags(this.db, titleId);
    });
  }
  deleteGenre(id: string) {
    return write(this.db, async () => {
      await this.getGenre(id);
      const associations = await this.db.titleGenres
        .where("genreId")
        .equals(id)
        .toArray();
      await this.db.titleGenres.where("genreId").equals(id).delete();
      await this.db.genres.delete(id);
      for (const association of associations)
        await refreshReviewFlags(this.db, association.titleId);
    });
  }
}
