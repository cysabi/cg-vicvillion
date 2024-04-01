import { open } from "lmdb";
import type { Patch } from "./types";

const STRUCTS_KEY = Symbol.for("structs_key");

export default class Persist<S> {
  #db;

  constructor(fp: string) {
    this.#db = open<Patch[]>(fp, { sharedStructuresKey: STRUCTS_KEY });
  }

  init(value: S) {
    return this.#db.putSync(0, [{ path: [], value }]);
  }

  clear() {
    return this.#db.transactionSync(() => {
      const structs = this.#db.get(Symbol.for("structs")) || [];
      this.#db.clearSync();
      this.#db.putSync(Symbol.for("structs"), structs);
    });
  }

  append(patches: Patch[]) {
    return this.#db.putSync(this.index() + 1, patches);
  }

  patches() {
    return this.#db.getRange({ start: 0 }).flatMap<Patch>(({ value }) => value);
  }

  index() {
    const index = this.#db.getKeys({ reverse: true, limit: 1 }).asArray[0];
    if (typeof index !== "number") {
      return -1;
    }
    return index;
  }
}
