import icepick from "icepick";
import { pack, unpack } from "msgpackr";

type Options<S> = { scopes?: string[][]; initial?: S; port?: number };

export class Client<S> {
  dispatch: null | ((state: S) => void) = null;
  #state: S;
  #ws: WebSocket;

  act(action: string, payload: any) {
    this.#send({ type: "action", action, payload });
  }

  constructor({ scopes, initial, port = 2513 }: Options<S> = {}) {
    this.#state = icepick.freeze(initial || ({} as S));

    this.#ws = new WebSocket(`ws://localhost:${port}`);
    this.#ws.binaryType = "arraybuffer";
    this.#send({ type: "init", scopes });
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
    if (this.dispatch) {
      this.dispatch(this.#state);
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
