import type { ServerWebSocket, WebSocketHandler } from "bun";
import { open } from "lmdb";
import { pack, unpack } from "msgpackr";
import Immutable from "immutable";

type Input<S> = {
  [key: string]: S[keyof S] | InputActions<S>[keyof InputActions<S>];
} & S;
type InputActions<S> = {
  [key: string]: InputAction<S> | InputActionAsync<S>;
  [key: `${string}Async`]: InputActionAsync<S>;
};
type InputAction<S> = (draft: Immutable.FromJS<S>, payload: any) => void;
type InputActionAsync<S> = (
  payload: any
) => Promise<(draft: Immutable.FromJS<S>) => void>;

export type Patch = { path: string[]; value?: any };
export type Message = MessageInit | MessageAction;
export type MessageInit = {
  type: "init";
  cursors: Patch["path"][];
};
export type MessageAction = {
  type: "action";
  action: string;
  payload: any;
};
export type Emit = {
  ws?: ServerWebSocket;
  patches?: Patch[];
};

export default class BunCG<S extends {}> {
  #db;
  #actions: InputActions<S> = {};
  #state: Immutable.FromJS<S>;
  #clients: Map<ServerWebSocket, MessageInit["cursors"]>;
  #websocket: WebSocketHandler;

  act(serverAction: (draft: Immutable.FromJS<S>) => void) {
    this.#handleActionMutate(serverAction);
  }

  serve(port = 2513) {
    Bun.serve({
      port,
      fetch(req, server) {
        server.upgrade(req);
      },
      websocket: this.#websocket,
    });
  }

  constructor(input: Input<S>, options = { db: "buncg.state" }) {
    this.#db = open(options.db, { sharedStructuresKey: Symbol.for("structs") });
    Object.entries(input).filter(([key, value]) => {
      if (typeof value === "function") {
        this.#actions[key] = value as InputAction<S>;
        delete input[key];
      }
    });
    this.#db.getRange({ start: 0 }).forEach((row) => {
      console.log(row.key, row.value);
    });
    this.#state = Immutable.fromJS(input).withMutations((draft) => {
      this.#db.getRange({ start: 0 }).forEach(({ value }) =>
        value.forEach((patch: Patch) => {
          if (patch.path.length === 0) {
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
    this.#persistCollapse();
    console.log("COLLAPSED");
    this.#db.getRange({ start: 0 }).forEach((row) => {
      console.log(row.key, row.value);
    });
    this.#clients = new Map();
    this.#websocket = {
      message: (ws, msg: Buffer) => {
        const data: Message = unpack(msg);

        console.log(`ws ~ message ~ ${JSON.stringify(data)}`);

        switch (data.type) {
          case "init":
            return this.#handleInit(data, ws);
          case "action":
            return this.#handleAction(data);
        }
      },
      open: (ws) => {
        console.log("ws ~ open");
      },
      close: (ws) => {
        console.log("ws ~ close");
        this.#clients.delete(ws);
      },
    };
  }

  #handleInit({ cursors }: MessageInit, ws: ServerWebSocket) {
    this.#clients.set(ws, cursors || [[]]);
    this.#emit({ ws });
  }

  #handleAction({ action, payload }: MessageAction) {
    const mutate = this.#actions?.[action];
    if (!mutate) return;
    if (action.endsWith("Async")) {
      const mutateAsync = mutate as InputActionAsync<S>;
      mutateAsync(payload).then((m) => this.#handleActionMutate(m));
    } else {
      this.#handleActionMutate(mutate, payload);
    }
  }

  #handleActionMutate(mutate: InputAction<S>, payload?: any) {
    const mutated = this.#state.withMutations((draft) =>
      mutate(draft, payload)
    );
    const patches = this.#deltaPatches(this.#state, mutated);
    console.log("patches1", patches);

    this.#state = mutated;
    this.#persistAppend(patches);
    this.#emit({ patches });
  }

  #deltaPatches(
    state: any,
    mutated: any,
    path: Patch["path"] = [],
    patches: Patch[] = []
  ): Patch[] {
    if (mutated instanceof Object && !Immutable.isImmutable(mutated))
      throw new Error(
        `State must only contain immutables! Found ${mutated} at ${path}`
      );
    if (mutated === state) return patches;
    if (Immutable.isKeyed(mutated) && Immutable.isKeyed(state)) {
      const keys = new Set();
      for (const key of state.keys()) keys.add(key);
      for (const key of mutated.keys()) keys.add(key);
      keys.forEach((key: any) => {
        this.#deltaPatches(
          state.get(key),
          mutated.get(key),
          path.concat(key.toString()),
          patches
        );
      });
    } else if (Immutable.isIndexed(mutated) && Immutable.isIndexed(state)) {
      for (let i = 0; i < Math.max(state.count(), mutated.count()); i++) {
        this.#deltaPatches(
          state.get(i),
          mutated.get(i),
          path.concat(i.toString()),
          patches
        );
      }
    } else if (mutated === undefined) {
      patches.push({ path });
    } else if (typeof mutated === "object") {
      console.log("ERROR NOT PRIMITIVE!!?!", mutated, typeof mutated);
    } else {
      patches.push({ path, value: mutated });
    }
    return patches;
  }

  #emit({ ws, patches }: Emit) {
    (ws
      ? ([[ws, this.#clients.get(ws)]] as const)
      : Array.from(this.#clients.entries())
    ).forEach(([ws, cursors]) => {
      ws.send(
        pack({
          type: "emit",
          patches: patches
            ? patches.filter((patch) =>
                cursors?.some((cursor) =>
                  cursor.every((c, i) =>
                    [c, undefined].includes(patch.path?.[i])
                  )
                )
              )
            : cursors?.map((c) => ({
                path: c,
                value: this.#state.getIn(c),
              })),
        })
      );
    });
  }

  #persistAppend(value: Patch[]) {
    let last = this.#db.getKeys({ reverse: true, limit: 1 }).asArray[0];
    if (typeof last !== "number") {
      this.#db.putSync(0, [{ path: [], value: this.#state }]);
      last = 0;
    }
    this.#db.putSync(last + 1, value);
  }

  #persistCollapse() {
    this.#db.transactionSync(() => {
      const structs = this.#db.get(Symbol.for("structs")) || [];
      this.#db.clearSync();
      this.#db.putSync(Symbol.for("structs"), structs);
      this.#db.putSync(0, [{ path: [], value: this.#state }]);
    });
  }
}
