import type { ServerWebSocket, WebSocketHandler } from "bun";
import { open } from "lmdb";
import { pack, unpack } from "msgpackr";
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

export type Patch = RootPatch | PatchPathed;
export type RootPatch = { path?: undefined; value: any };
export type PatchPathed = { path: string[]; value?: any };

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
  patches: Patch[];
};

export default class BunCG<S extends {}> {
  #filepath = "buncg.state";
  #structs = Symbol.for("$structs");
  _db;
  _state: Immutable.FromJS<S>;
  _actions;
  _websocket: WebSocketHandler;
  _watchers: Watcher[];

  constructor(input: Input<S>) {
    this._db = open(this.#filepath, {
      sharedStructuresKey: this.#structs,
    });
    this._state = Immutable.fromJS(input.state).withMutations((draft) => {
      this._db.getRange({ start: 0 }).forEach(({ value }) =>
        value.forEach((patch: PatchPathed) => {
          if ((patch.path || []).length === 0) {
            draft.clear();
            draft.merge(Immutable.fromJS(patch.value));
          } else if (patch.value === undefined) {
            draft.deleteIn(patch.path);
          } else {
            draft.setIn(patch.path, patch.value);
          }
        })
      );
    });
    this._actions = input.actions;
    this._websocket = {
      message: (ws, msg: Buffer) => {
        const data: Message = unpack(msg);

        console.log(`ws ~ message ~ ${data}`);

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
    const patches = this._deltaPatches(this._state, mutated);
    const events = this._eventsTrigger(mutated, patches);

    this._state = mutated;

    this._persistAppend(patches);
    this._eventsEmit(...events);
  }

  _handleWatch({ id, cursor }: MessageWatch, ws: ServerWebSocket) {
    this._watchers.push({ ws, id, cursor });
    this._eventsEmit({
      ws,
      id,
      patches: [{ path: cursor, value: this._state.getIn(cursor) }],
    });
  }

  _handleUnwatch({ id }: MessageWatch) {
    this._watchers = this._watchers.filter((watcher) => !(watcher.id === id));
  }

  _deltaPatches(
    state: any,
    mutated: any,
    path: Patch["path"] = [],
    patches: PatchPathed[] = []
  ): PatchPathed[] {
    if (mutated instanceof Object && !Immutable.isImmutable(mutated))
      throw new Error(
        `State must only contain immutables! Found ${mutated} at ${path}`
      );
    if (mutated === state) return patches;
    if (Immutable.isKeyed(mutated) && Immutable.isKeyed(state)) {
      const keys = new Set();
      for (const key in state) keys.add(key);
      for (const key in mutated) keys.add(key);
      keys.forEach((key: any) => {
        this._deltaPatches(
          state.get(key),
          mutated.get(key),
          path.concat(key.toString())
        );
      });
    } else if (Immutable.isIndexed(mutated) && Immutable.isIndexed(state)) {
      for (let i = 0; i < Math.max(state.count(), mutated.count()); i++) {
        this._deltaPatches(
          state.get(i),
          mutated.get(i),
          path.concat(i.toString())
        );
      }
    } else if (mutated == undefined) {
      patches.push({ path });
    } else {
      patches.push({ path, value: mutated });
    }
    return patches;
  }

  _eventsTrigger(mutated: Immutable.FromJS<S>, patches: PatchPathed[]) {
    const events: Emit[] = [];
    this._watchers.forEach(({ ws, id, cursor }) => {
      if (mutated.getIn(cursor) !== this._state.getIn(cursor)) {
        events.push({
          ws,
          id,
          patches: patches.filter((patch) =>
            cursor.every((c, i) => [c, undefined].includes(patch.path?.[i]))
          ),
        });
      }
    });
    return events;
  }

  _eventsEmit(...events: Emit[]) {
    events.forEach(({ ws, id, patches }) =>
      ws.send(
        pack({
          type: "emit",
          id,
          patches,
        })
      )
    );
  }

  _persistAppend(value: Patch[]) {
    let last = this._db.getKeys({ reverse: true, limit: 1 }).asArray[0];
    if (typeof last !== "number") {
      this._db.put(0, [{ value: this._state }]);
      last = 0;
    }
    this._db.put(last + 1, value);
  }

  _persistCollapse() {
    this._db.transactionSync(() => {
      const structs = this._db.get(this.#structs) || [];
      this._db.clearSync();
      this._db.putSync(this.#structs, structs);
      this._db.putSync(0, [{ value: this._state }]);
    });
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
