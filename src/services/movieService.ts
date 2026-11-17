import { TitleRecordService } from "./titleRecordService";
import type { TitleSaveInput, TitleEditIdentity } from "./titleRecordService";
export { metadataFromTitle, firstWatchedDate } from "./titleRecordService";
export type {
  DirectorChoice,
  TitleRecord as MovieRecord,
  TitleSaveInput as MovieSaveInput,
  TitleEditIdentity as MovieEditIdentity,
} from "./titleRecordService";
/** Compatibility facade for the Phase 4 movie workflow. */
export class MovieService extends TitleRecordService {
  getMovie(id: string) {
    return this.getRecord(id);
  }
  listDeletedMovies() {
    return this.listDeleted();
  }
  saveMovie(input: TitleSaveInput, edit?: TitleEditIdentity, confirm = false) {
    return this.saveRecord(input, edit, confirm);
  }
}
