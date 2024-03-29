import type { ServerWebSocket, WebSocketHandler } from "bun";
import { readFileSync } from "node:fs";
import Immutable from "immutable";

type Input<S> = {
  state: S;
  actions?: {
    [key: string]: InputAction<S> | InputActionAsync<S>;
    [key: `${string}Async`]: InputActionAsync<S>;
  };
};
type InputAction<S> = (
  draft: Immutable.FromJS<S>,
  payload: MessageAction["payload"]
) => void;
type InputActionAsync<S> = (
  payload: MessageAction["payload"]
) => Promise<(draft: Immutable.FromJS<S>) => void>;

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
  cursor: string[];
  id: string;
};
export type Emit = {
  ws: ServerWebSocket;
  id: string;
  state: any;
};

export default class BunCG<S extends {}> {
  #filepath = "buncg.state";
  _state: Immutable.FromJS<S>;
  _actions;
  _websocket: WebSocketHandler;
  _watchers: Watcher[];

  constructor(input: Input<S>) {
    this._state = Immutable.fromJS(this._withPersisted(input.state));
    this._actions = input.actions;
    this._websocket = {
      message: (ws, msg: string) => {
        console.log(`ws ~ message ~ ${msg}`);
        const data: Message = JSON.parse(msg);

        switch (data.type) {
          case "action":
            return this._handleAction(data);
          case "watch":
            return this._handleWatch(data, ws);
          case "unwatch":
            return this._handleUnwatch(data);
        }
      },
      open: (ws) => {
        console.log("ws ~ open");
      },
      close: (ws) => {
        console.log("ws ~ close");
        this._watchers = this._watchers.filter(
          (watcher) => !(watcher.ws === ws)
        );
      },
    };
    this._watchers = [];
  }

  _handleAction({ action, payload }: MessageAction) {
    const mutate = this._actions?.[action];
    if (!mutate) return;
    if (action.endsWith("Async")) {
      const mutateAsync = mutate as InputActionAsync<S>;
      mutateAsync(payload).then((m) => this._handleActionMutate(m));
    } else {
      this._handleActionMutate(mutate, payload);
    }
  }

  _handleActionMutate(mutate: InputAction<S>, payload?: any) {
    const mutated = this._state.withMutations((draft) =>
      mutate(draft, payload)
    );

    // queue events
    const events: Emit[] = [];
    this._watchers.forEach(({ ws, id, cursor }) => {
      const state = mutated.getIn(cursor);
      if (state !== this._state.getIn(cursor)) {
        events.push({ ws, id, state });
      }
    });

    // set new state, persist, then emit queued events
    this._state = mutated;
    this._persist();
    events.forEach((e) => this._emit(e));
  }

  _handleWatch({ id, cursor }: MessageWatch, ws: ServerWebSocket) {
    this._watchers.push({ ws, id, cursor });
    this._emit({ ws, id, state: this._state.getIn(cursor) });
  }

  _handleUnwatch({ id }: MessageWatch) {
    this._watchers = this._watchers.filter((watcher) => !(watcher.id === id));
  }

  _emit({ ws, id, state }: Emit) {
    ws.send(
      JSON.stringify({
        type: "emit",
        id,
        state,
      })
    );
  }

  _withPersisted(fallback: unknown) {
    try {
      return JSON.parse(readFileSync(this.#filepath, "utf8"));
    } catch {
      return fallback;
    }
  }

  _persist() {
    Bun.write(this.#filepath, JSON.stringify(this._state));
  }

  /* public methods */

  act(serverAction: (draft: Immutable.FromJS<S>) => void) {
    this._handleActionMutate(serverAction);
  }

  serve(port = 2513) {
    Bun.serve({
      port,
      fetch(req, server) {
        server.upgrade(req);
      },
      websocket: this._websocket,
    });
  }
}
