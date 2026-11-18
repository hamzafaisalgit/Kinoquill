import { localDatabase } from "../localDatabase";
import { ImportService } from "./importService";
export const importDatabase = localDatabase.database;
export const importer = new ImportService(importDatabase);
