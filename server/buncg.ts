import type { ServerWebSocket, WebSocketHandler } from "bun";
import { open } from "lmdb";
import { pack, unpack } from "msgpackr";
import type {
  InputActionAsync,
  InputActions,
  Message,
  MessageInit,
  InputAction,
  Input,
  Patch,
  MessageAction,
  Emit,
  Clients,
} from "./types";
import State from "./state";

export default class BunCG<S extends Record<string, any>> {
  #state: State<S>;
  #actions: InputActions<S> = {};
  #db;
  #clients: Clients;
  #websocket: WebSocketHandler;

  serve(port = 2513) {
    Bun.serve({
      port,
      fetch(req, server) {
        server.upgrade(req);
      },
      websocket: this.#websocket,
    });
  }

  act(serverAction: (draft: S) => void) {
    this.#handleActionMutate(serverAction);
  }

  constructor(input: Input<S>, options = { db: "buncg.state" }) {
    Object.entries(input).filter(([key, value]) => {
      if (typeof value === "function") {
        this.#actions[key] = value as InputAction<S>;
        delete input[key];
      }
    });
    this.#state = new State<S>(input);

    this.#db = open(options.db, { sharedStructuresKey: Symbol.for("structs") });
    // this.#state.sink = this.#db
    //   .getRange({ start: 0 })
    //   .flatMap<Patch>(({ value }) => value).asArray;
    // this.#state.flush();
    // this.#db.transactionSync(() => {
    //   const structs = this.#db.get(Symbol.for("structs")) || [];
    //   this.#db.clearSync();
    //   this.#db.putSync(Symbol.for("structs"), structs);
    //   this.#db.putSync(0, [{ path: [], value: this.#state.snap() }]);
    // });

    this.#clients = new Map();
    this.#websocket = {
      message: (ws, msg: Buffer) => {
        const data: Message = unpack(msg);

        console.info(`ws ~ message ~ ${JSON.stringify(data)}`);

        switch (data.type) {
          case "init":
            return this.#handleInit(data, ws);
          case "action":
            return this.#handleAction(data);
        }
      },
      open: (ws) => {
        console.info("ws ~ open");
      },
      close: (ws) => {
        console.info("ws ~ close");
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
    this.#state.withStream((draft) => {
      mutate(draft, payload);
    });

    // persist
    let last = this.#db.getKeys({ reverse: true, limit: 1 }).asArray[0];
    if (typeof last !== "number") {
      this.#db.putSync(0, [{ path: [], value: this.#state.snap() }]);
      last = 0;
    }
    this.#db.putSync(last + 1, this.#state.sink);
    // events
    this.#emit({ patches: this.#state.sink });
    // mutate
    this.#state.flush();
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
                value: c.reduce((slice, p) => slice?.[p], this.#state.snap()),
              })),
        })
      );
    });
  }
}
