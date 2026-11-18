import { localDatabase } from "./localDatabase";
import { TitleService } from "./titleService";
import { GenreService } from "./genreService";
import { PersonService } from "./personService";
import { CategoryService } from "./categoryService";
import { LibraryService } from "./libraryService";
import { ViewingService } from "./viewingService";
import { TvProgressService } from "./tvProgressService";
import { MovieService } from "./movieService";
import { ShowService } from "./showService";
import { PersonalService } from "./personalService";
import type { KinoquillDatabase } from "../db/database";

/** Inject an isolated database for tests; production uses the Phase 1 singleton. */
export function createCatalog(db: KinoquillDatabase) {
  return {
    titles: new TitleService(db),
    genres: new GenreService(db),
    people: new PersonService(db),
    categories: new CategoryService(db),
    library: new LibraryService(db),
    viewing: new ViewingService(db),
    tv: new TvProgressService(db),
    movies: new MovieService(db),
    shows: new ShowService(db),
    personal: new PersonalService(db),
  };
}

export const catalog = createCatalog(localDatabase.database);
