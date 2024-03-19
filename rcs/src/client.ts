export type Message = MessageEmit;
export type MessageEmit = {
  type: "emit";
  id: string;
  state: unknown;
};

export class Client {
  ws: WebSocket;
  listeners: { [id: string]: (state: unknown) => void };
  [any: string]: any;

  constructor(url = `ws://${location.host}`) {
    this.ws = new WebSocket(url);
    this.listeners = {};

    this.ws.addEventListener("message", (event) => {
      const data: Message = JSON.parse(event.data);

      switch (data.type) {
        case "emit":
          return this.handleEmit(data);
      }
    });
  }

  handleEmit(data: MessageEmit) {
    console.log(this.listeners);
    this.listeners[data.id](data.state);
  }

  act(action: string, payload: any) {
    this.send({ type: "action", action, payload });
  }

  watch(c: string | string[], callback: (state: unknown) => void) {
    const cursor = Array.isArray(c) ? c.join(".") : c;
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
    this.ws.send(JSON.stringify(obj));
  }
}
