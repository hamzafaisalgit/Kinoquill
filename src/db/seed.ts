import type { KinoquillDatabase } from "./database";
import { newId, normalizeName, now } from "../utils/normalization";

export const INITIAL_GENRES = [
  "Action",
  "Adventure",
  "Animation",
  "Biography",
  "Comedy",
  "Crime",
  "Documentary",
  "Drama",
  "Family",
  "Fantasy",
  "History",
  "Horror",
  "Music",
  "Musical",
  "Mystery",
  "Romance",
  "Science Fiction",
  "Sport",
  "Thriller",
  "War",
  "Western",
];
export async function seedGenres(db: KinoquillDatabase): Promise<void> {
  await db.transaction("rw", [db.genres, db.localMetadata], async () => {
    if (await db.localMetadata.get('genre-catalog-v1')) return
    for (const name of INITIAL_GENRES) {
      const normalizedName = normalizeName(name);
      if (
        !(await db.genres
          .where("normalizedName")
          .equals(normalizedName)
          .first())
      ) {
        await db.genres.add({
          id: newId(),
          name,
          normalizedName,
          createdAt: now(),
        });
      }
    }
    await db.localMetadata.put({ key: 'genre-catalog-v1', value: now() })
  });
}
