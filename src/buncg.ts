import type { ServerWebSocket, WebSocketHandler } from "bun";
import { Database } from "bun:sqlite";
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
  _db;
  _state: Immutable.FromJS<S>;
  _actions;
  _watchers: Watcher[];
  _websocket: WebSocketHandler;

  constructor(model: Input<S>) {
    this._db = new Database("buncg.sqlite");
    this._state = Immutable.fromJS(model.state);
    this._actions = model.actions;
    this._watchers = [];
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

    // after mutate, build a new delta tree
    const tree = this._delta(this._state, mutated);
    // persist new delta tree

    // queue events
    const events: Emit[] = [];
    this._watchers.forEach(({ ws, id, cursor }) => {
      const state = mutated.getIn(cursor);
      if (state !== this._state.getIn(cursor)) {
        events.push({ ws, id, state });
      }
    });

    // set new state, then emit queued events
    this._state = mutated;
    events.forEach((e) => this._emit(e));
  }

  _delta_delete = "$$__buncg.delete__$$";
  _delta(state: any, mutated: any, path: string = "") {
    if (!Immutable.isImmutable(mutated) && mutated instanceof Object)
      throw new Error(
        `State must only contain immutables! Found ${mutated} at ${path}`
      );
    if (mutated === this._delta_delete)
      throw new Error(
        `Invalid string! ${mutated} is a reserved keyword. If you are trying to delete a value, simply do so in the action callback.`
      );
    if (mutated === state) return;
    if (mutated == undefined) return this._delta_delete;

    let delta = mutated;
    if ((Immutable.isKeyed(mutated), Immutable.isKeyed(state))) {
      delta = {};
      const keys = new Set();
      for (const key in state) keys.add(key);
      for (const key in mutated) keys.add(key);
      keys.forEach((key: any) => {
        delta[key] = this._delta(
          state.get(key),
          mutated.get(key),
          path + "." + key
        );
      });
    }
    if (Immutable.isIndexed(mutated) && Immutable.isIndexed(state)) {
      delta = [];
      for (let i = 0; i < Math.max(state.count(), mutated.count()); i++) {
        delta.push(this._delta(state.get(i), mutated.get(i), path + "." + i));
      }
    }
    return delta;
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
