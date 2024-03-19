import type { ServerWebSocket, WebSocketHandler } from "bun";
import { createDraft, finishDraft, enablePatches, type Patch } from "immer";

type Input<S> = {
  [key: string]: S[keyof S] | InputAction<S>;
};
type InputAction<S> = (
  payload: MessageAction["payload"],
  draft: S
) => void | Promise<(draft: S) => void>;

export type Message = MessageAction | MessageWatch;
export type MessageAction = {
  type: "action";
  action: string;
  payload: any;
};
export type MessageWatch = {
  type: "watch" | "unwatch";
  cursor: string;
  id: string;
};

export type Watcher = {
  ws: ServerWebSocket;
  cursor: string;
  id: string;
};

export default class Model<S> {
  state: Record<string, any>;
  actions: Record<string, InputAction<S>>;
  watchers: Watcher[];
  websocket: WebSocketHandler;

  constructor(model: Input<S>) {
    enablePatches();

    this.state = {};
    this.actions = {};
    this.watchers = [];

    // split up state and actions from input
    Object.entries(model).forEach(([modelKey, modelValue]) => {
      if (typeof modelValue === "function") {
        this.actions[modelKey] = modelValue as InputAction<S>;
      } else {
        // use immer value for state
        const draft = createDraft(this.state);
        draft[modelKey] = modelValue;
        this.state = finishDraft(draft);
      }
    });

    // create server
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
    const resolver: any = this.actions[action];
    let draft;
    if (resolver.length === 1) {
      const subresolver = await resolver(payload);
      draft = createDraft(this.state);
      subresolver(draft as S);
    } else {
      draft = createDraft(this.state);
      resolver(payload, draft as S);
    }
    let patches: Patch[];
    this.state = finishDraft(draft, (p) => (patches = p));
    this.watchers.forEach(({ ws, id, cursor }) => {
      if (patches.some(({ path }) => this.cursorSeesPath(cursor, path))) {
        this.emit({ ws, id, cursor });
      }
    });
  }

  handleWatch({ id, cursor }: MessageWatch, ws: ServerWebSocket) {
    this.watchers.push({ ws, id, cursor });
    this.emit({ ws, id, cursor });
  }

  handleUnwatch({ id }: MessageWatch) {
    this.watchers = this.watchers.filter((watcher) => !(watcher.id === id));
  }

  emit({ ws, id, cursor }: Watcher) {
    ws.send(
      JSON.stringify({
        type: "emit",
        id,
        state: this.cursorState(cursor),
      })
    );
  }

  cursorState(cursor: string) {
    return cursor
      .split(".")
      .reduce((state, path) => (path ? state[path] : state), this.state);
  }

  cursorSeesPath(cursor: string, path: (string | number)[]) {
    return (
      cursor === "" ||
      cursor
        .split(".")
        .every((p, i) => [p, undefined].includes(path[i]?.toString()))
    );
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
