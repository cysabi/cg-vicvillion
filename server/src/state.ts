import type { Patch } from "./types";

export default class State<S> {
  withStream(er: (state: S) => void) {
    try {
      this.#streaming = true;
      er(this.#state);
    } finally {
      this.#streaming = false;
    }
  }

  snap() {
    this.#assertNotStreaming();
    return this.#state;
  }

  flush() {
    this.#assertNotStreaming();
    try {
      this.sink.forEach((patch: Patch) => {
        if (patch.path.length === 0) {
          this.#state = this.#proxify(patch.value);
        } else {
          patch.path.reduce((slice: any, p, i) => {
            if (i !== patch.path.length - 1) {
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

  sink: Patch[] = [];

  #state: S;
  #streaming: boolean = false;

  constructor(state: S) {
    this.#state = this.#proxify(state);
  }

  #proxify(value: any, path: string[] = []): any {
    if (value?.[PROXY]) {
      return value;
    }

    if (Array.isArray(value)) {
      return new Proxy(value, {
        get: (target: any, prop: any) => {
          if (prop === PROXY) {
            return true;
          }
          target[prop] = this.#proxify(target[prop], [...path, prop]);

          if (ARRAY_MUTATORS.has(prop)) {
            return (...args: any[]) => {
              if (!this.#streaming) {
                return target[prop](...args);
              }
              const state = this.#proxifyGet(target, path).slice();
              this.#stream(path, state);
              return this.#proxify(state[prop](...args), path);
            };
          }

          return this.#proxifyGet(target[prop], [...path, prop]);
        },
        set: this.#proxifySet(path),
      });
    }

    if (
      Object.prototype.toString.call(value) !== "[object Object]"
        ? false
        : value.constructor === undefined
        ? true
        : Object.prototype.toString.call(value.constructor.prototype) !==
          "[object Object]"
        ? false
        : value.constructor.prototype.hasOwnProperty("isPrototypeOf") === false
        ? false
        : true
    ) {
      return new Proxy(value, {
        get: (target: any, prop: any) => {
          if (prop === PROXY) {
            return true;
          }
          target[prop] = this.#proxify(target[prop], [...path, prop]);
          return this.#proxifyGet(target[prop], [...path, prop]);
        },
        set: this.#proxifySet(path),
        deleteProperty: this.#proxifySet(path),
      });
    }

    return value;
  }

  #proxifyGet(prepatched: any, path: string[]) {
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

  #proxifySet(path: string[]) {
    return (target: any, prop: string | symbol, newValue?: any) => {
      if (!this.#streaming) {
        if (newValue !== undefined) {
          return (target[prop] = newValue);
        }
        return delete target[prop];
      }
      return this.#stream([...path, prop as string], newValue);
    };
  }

  #stream(path: string[], value?: Patch[]) {
    this.#assertStreaming();

    this.sink.push({ path, value });
    return true;
  }

  #assertStreaming() {
    if (!this.#streaming) {
      throw Error(
        "Stream is not open! Are you trying to mutate state outside of `.withStream()`?"
      );
    }
  }

  #assertNotStreaming() {
    if (this.#streaming) {
      throw Error(
        "Stream is currently open! Make sure you're calling this outside of a stream."
      );
    }
  }
}

const PROXY = Symbol.for("proxy");
const ARRAY_MUTATORS = new Set([
  "push",
  "shift",
  "pop",
  "unshift",
  "splice",
  "reverse",
  "sort",
  "copyWithin",
]);
