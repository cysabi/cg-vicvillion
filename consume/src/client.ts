import icepick from "icepick";
import { pack, unpack } from "msgpackr";

type Options<S> = { cursors?: string[][]; initialState?: S };

export class Client<S> {
  #state: S;
  #watcher: null | ((state: S) => void) = null;
  #ws: WebSocket;

  act(action: string, payload: any) {
    this.#send({ type: "action", action, payload });
  }

  watch(callback: (state: S) => void) {
    this.#watcher = callback;
    return () => {
      this.#watcher = null;
    };
  }

  constructor({ cursors, initialState }: Options<S> = {}) {
    this.#state = icepick.freeze(initialState || ({} as S));

    this.#ws = new WebSocket("ws://localhost:2513");
    this.#ws.binaryType = "arraybuffer";
    this.#send({ type: "init", cursors });
    this.#ws.addEventListener("message", (event) => {
      const data = unpack(event.data);

      switch (data.type) {
        case "emit":
          return this.#handleEmit(data);
      }
    });
  }

  #handleEmit(data: {
    type: "emit";
    patches: Array<{ path: string[]; value?: any }>;
  }) {
    data.patches.forEach((patch) => {
      if (patch.path.length === 0) {
        this.#state = icepick.freeze(patch.value);
      } else if (patch.value) {
        this.#state = icepick.setIn(this.#state, patch.path, patch.value);
      } else {
        this.#state = icepick.unsetIn(this.#state, patch.path);
      }
    });
    if (this.#watcher) {
      this.#watcher(this.#state);
    }
  }

  async #send(obj: any) {
    await new Promise<void>((resolve) => {
      if (this.#ws.readyState !== this.#ws.OPEN) {
        this.#ws.addEventListener("open", () => resolve());
      } else {
        resolve();
      }
    });
    this.#ws.send(pack(obj));
  }
}
