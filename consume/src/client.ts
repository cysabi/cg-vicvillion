import { pack, unpack } from "msgpackr";

type Emit = {
  type: "emit";
  id: string;
  patches: Array<
    { path?: undefined; value: any } | { path: string[]; value?: any }
  >;
};

export class Client {
  ws: WebSocket;
  listeners: { [id: string]: (state: unknown) => void };
  [any: string]: any;

  constructor() {
    this.ws = new WebSocket(`ws://${location.host}`);
    this.listeners = {};
    this.ws.binaryType = "arraybuffer";
    this.ws.addEventListener("message", (event) => {
      const data = unpack(event.data);

      switch (data.type) {
        case "emit":
          return this.handleEmit(data);
      }
    });
  }

  handleEmit(data: Emit) {
    // has own state,
    this.listeners[data.id](data);
  }

  act(action: string, payload: any) {
    this.send({ type: "action", action, payload });
  }

  watch(cursor: string[], callback: (state: unknown) => void) {
    const id = "listener_" + Math.random().toString(16).slice(2);

    this.listeners[id] = callback;
    this.send({ type: "watch", id, cursor });

    return () => {
      delete this.listeners[id];
      this.send({ type: "unwatch", id });
    };
  }

  async send(obj: any) {
    await new Promise<void>((resolve) => {
      if (this.ws.readyState !== this.ws.OPEN) {
        this.ws.addEventListener("open", () => resolve());
      } else {
        resolve();
      }
    });
    this.ws.send(pack(obj));
  }
}
