import type { KinoquillDatabase } from "../db/database";
import type { PersonRole } from "../types/domain";
import {
  personCreateSchema,
  personLinkSchema,
  validate,
} from "../utils/validation";
import { newId, normalizeName, now } from "../utils/normalization";
import { required, write } from "./domainSupport";
import { ConflictError } from "../utils/errors";

export class PersonService {
  private readonly db: KinoquillDatabase;
  constructor(db: KinoquillDatabase) {
    this.db = db;
  }
  async createPerson(input: { name: string }) {
    const { name } = validate(personCreateSchema, input);
    return write(this.db, async () => {
      const person = {
        id: newId(),
        name,
        normalizedName: normalizeName(name),
        createdAt: now(),
        updatedAt: now(),
      };
      await this.db.people.add(person);
      return person;
    });
  }
  getPerson(id: string) {
    return required(this.db.people, id, "Person");
  }
  listPeople() {
    return this.db.people.orderBy("normalizedName").toArray();
  }
  async getTitlePeople(titleId: string) {
    return this.db.transaction(
      "r",
      [this.db.titles, this.db.titlePeople, this.db.people],
      async () => {
        await required(this.db.titles, titleId, "Title");
        const links = await this.db.titlePeople
          .where("titleId")
          .equals(titleId)
          .toArray();
        return Promise.all(
          links.map(async (link) => ({
            role: link.role,
            person: await this.getPerson(link.personId),
          })),
        );
      },
    );
  }
  async updatePerson(id: string, input: { name: string }) {
    const { name } = validate(personCreateSchema, input);
    return write(this.db, async () => {
      const person = {
        ...(await this.getPerson(id)),
        name,
        normalizedName: normalizeName(name),
        updatedAt: now(),
      };
      await this.db.people.put(person);
      return person;
    });
  }
  async attachPersonToTitle(
    titleId: string,
    personId: string,
    role: PersonRole,
  ) {
    const link = validate(personLinkSchema, { personId, role });
    return write(this.db, async () => {
      await required(this.db.titles, titleId, "Title");
      await this.getPerson(personId);
      if (await this.db.titlePeople.get([titleId, personId, role]))
        throw new ConflictError("This person and role are already attached.");
      await this.db.titlePeople.add({ titleId, ...link });
    });
  }
  async detachPersonFromTitle(
    titleId: string,
    personId: string,
    role: PersonRole,
  ) {
    validate(personLinkSchema, { personId, role });
    return write(this.db, async () => {
      await required(this.db.titles, titleId, "Title");
      await this.getPerson(personId);
      await this.db.titlePeople.delete([titleId, personId, role]);
    });
  }
}
