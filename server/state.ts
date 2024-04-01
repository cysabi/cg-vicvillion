import type { Patch } from "./types";

export default class State<S> {
  #streaming: boolean = false;
  sink: Patch[] = [];

  withStream(er: (state: S) => void) {
    try {
      this.#streaming = true;
      er(this.#state);
    } finally {
      this.#streaming = false;
    }
  }

  snap() {
    if (this.#streaming) {
      throw Error(
        "Stream is currently open! Make sure you're calling this outside of a stream."
      );
    }
    return this.#state;
  }

  flush() {
    if (this.#streaming) {
      throw Error(
        "Stream is currently open! Make sure you're calling this outside of a stream."
      );
    }
    try {
      this.sink.forEach((patch: Patch) => {
        if (patch.path.length === 0) {
          this.#state = this.#proxify(patch.value);
        } else {
          patch.path.reduce((slice, p, i) => {
            if (i !== patch.path.length - 1) {
              console.log("~~~~~~~~~~");
              console.log("patch", patch);
              console.log("set prop", slice[p]);
              console.log("prop proxied", slice[p][this.#proxified]);
              return slice[p];
            }
            if (patch.value === undefined) {
              delete slice[p];
            } else {
              slice[p] = patch.value;
            }
          }, this.#state);
        }
      });
    } finally {
      this.sink = [];
    }
  }

  #state;
  constructor(state: S) {
    this.#state = this.#proxify(state);
  }

  #mutators = new Set([
    "push",
    "shift",
    "pop",
    "unshift",
    "splice",
    "reverse",
    "sort",
    "copyWithin",
  ]);
  #proxified = Symbol.for("proxified");
  #proxify(value: any, path: string[] = []): any {
    if (value?.[this.#proxified]) return value;
    if (Array.isArray(value))
      return new Proxy(value, {
        get: (target: any, prop: any) => {
          if (prop === this.#proxified) return true;
          target[prop] = this.#proxify(target[prop], [...path, prop]);

          if (this.#mutators.has(prop)) {
            return (...args: any[]) => {
              if (!this.#streaming) {
                return target[prop](...args);
              }
              const state = this.#proxifyWithPatches(target, path);
              const mutated = state.slice()[prop](...args);
              this.#proxifyStreamPatch(path, mutated);
              return this.#proxify(mutated, path);
            };
          }
          return this.#proxifyWithPatches(target[prop], [...path, prop]);
        },
        set: this.#proxifySet(path),
      });
    if (value?.constructor === Object)
      return new Proxy(value, {
        get: (target: any, prop: any) => {
          if (prop === this.#proxified) return true;
          target[prop] = this.#proxify(target[prop], [...path, prop]);
          return this.#proxifyWithPatches(target[prop], [...path, prop]);
        },
        set: this.#proxifySet(path),
        deleteProperty: this.#proxifySet(path),
      });
    return value;
  }
  #proxifySet(path: string[]) {
    return (target: any, prop: string | symbol, newValue?: any) => {
      if (!this.#streaming) {
        if (newValue) return (target[prop] = newValue);
        return delete target[prop];
      }
      return this.#proxifyStreamPatch([...path, prop as string], newValue);
    };
  }
  #proxifyStreamPatch(path: string[], value?: Patch[]) {
    if (!this.#streaming) {
      throw Error(
        "Stream is not open! Are you trying to mutate state outside of `.withStream()`?"
      );
    }
    this.sink.push({ path, value });
    return true;
  }
  #proxifyWithPatches(prepatched: any, path: string[]) {
    if (!this.#streaming) {
      return prepatched;
    }
    const patch = this.sink.findLast(
      (p) => path.join("\\") === p.path.join("\\")
    );
    if (patch) {
      return this.#proxify(patch.value, path);
    }
    return prepatched;
  }
}
