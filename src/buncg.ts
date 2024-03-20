import type { ServerWebSocket, WebSocketHandler } from "bun";
import { klona } from "klona/json";

type Input<S> = {
  state: S;
  actions?: {
    [key: string]: InputAction<S> | InputActionAsync<S>;
    [key: `${string}Async`]: InputActionAsync<S>;
  };
};
type InputAction<S> = (draft: S, payload: MessageAction["payload"]) => void;
type InputActionAsync<S> = (
  payload: MessageAction["payload"]
) => Promise<(draft: S) => void>;

export type Message = MessageAction | MessageWatch;
export type MessageAction = {
  type: "action";
  action: string;
  payload: any;
};
export type MessageWatch = {
  type: "watch" | "unwatch";
} & Watch;
export type Watcher = {
  ws: ServerWebSocket;
} & Watch;
export type Watch = {
  cursor: string;
  id: string;
};
export type Emit<S> = {
  ws: ServerWebSocket;
  id: string;
  state: S | S[keyof S];
};

export default class BunCG<S extends Readonly<Record<string, any>>> {
  state;
  actions;
  watchers: Watcher[];
  websocket: WebSocketHandler;

  constructor(model: Input<S>) {
    this.state = Object.freeze(model.state);
    this.actions = model.actions;
    this.watchers = [];
    this.websocket = {
      message: (ws, msg: string) => {
        console.log(`ws ~ message ~ ${msg}`);
        const data: Message = JSON.parse(msg);

        switch (data.type) {
          case "action":
            return this.handleAction(data);
          case "watch":
            return this.handleWatch(data, ws);
          case "unwatch":
            return this.handleUnwatch(data);
        }
      },
      open: (ws) => {
        console.log("ws ~ open");
      },
      close: (ws) => {
        console.log("ws ~ close");
        this.watchers = this.watchers.filter((watcher) => !(watcher.ws === ws));
      },
    };
  }

  async handleAction({ action, payload }: MessageAction) {
    const resolve = this.actions?.[action];
    if (!resolve) return;

    let draft: S;
    if (action.endsWith("Async")) {
      const subresolve = await (resolve as InputActionAsync<S>)(payload);
      draft = this.createDraft();
      subresolve(draft);
    } else {
      draft = this.createDraft();
      resolve(draft, payload);
    }
    const toEmit: Emit<S>[] = [];
    this.watchers.forEach(({ ws, id, cursor }) => {
      const oldState = this.stateAt(cursor);
      const newState = this.stateAt(cursor, draft);
      if (Bun.deepEquals(oldState, newState)) {
        toEmit.push({ ws, id, state: newState });
      }
    });
    this.finishDraft(draft);
    toEmit.forEach((e) => this.emit(e));
  }

  handleWatch({ id, cursor }: MessageWatch, ws: ServerWebSocket) {
    this.watchers.push({ ws, id, cursor });
    this.emit({ ws, id, state: this.stateAt(cursor) });
  }

  handleUnwatch({ id }: MessageWatch) {
    this.watchers = this.watchers.filter((watcher) => !(watcher.id === id));
  }

  emit({ ws, id, state }: Emit<S>) {
    ws.send(
      JSON.stringify({
        type: "emit",
        id,
        state,
      })
    );
  }

  stateAt(cursor: string = "", baseState = this.state) {
    return cursor
      .split(".")
      .reduce((state, path) => (path ? state[path] : state), baseState);
  }

  createDraft() {
    return klona(this.state);
  }

  finishDraft(draft: S) {
    this.state = Object.freeze(draft);
  }

  serve(port = 2513) {
    Bun.serve({
      port,
      fetch(req, server) {
        server.upgrade(req);
      },
      websocket: this.websocket,
    });
  }
}
