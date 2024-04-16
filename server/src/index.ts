import { pack, unpack } from "msgpackr";
import State from "./state";
import Persist from "./persist";
import type {
  Message,
  MessageInit,
  InputAction,
  Input,
  MessageAction,
  Emit,
  Clients,
  ServerWebSocket,
} from "./types";

export default class BunCG<S> {
  config: {
    state: S;
    actions: Record<string, InputAction<S>>;
  };

  constructor(input: Input<S>) {
    this.config = {
      actions: {},
      state: {} as S,
    };
    // deep search for an external lib
    Object.entries(input).filter(([key, value]) => {
      if (typeof value === "function") {
        delete input[key];
        this.config.actions[key] = value as InputAction<S>;
      }
    });
    this.config.state = input;
  }

  #state!: State<S>;
  #actions!: { [key: string]: InputAction<S> };
  #persist!: Persist<S>;
  #clients!: Clients;

  run({ port, db } = { port: 2513, db: "state.persist" }) {
    this.#state = new State<S>(this.config.state);
    this.#actions = this.config.actions;
    this.#persist = new Persist(db);

    // setup persistence
    this.#state.sink = this.#persist.patches().asArray;
    this.#state.flush();

    this.#persist.clear();
    this.#persist.init(this.#state.snap());

    // run server
    this.#clients = new Map();
    Bun.serve({
      port,
      fetch(req, server) {
        server.upgrade(req);
      },
      websocket: {
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
      },
    });
  }

  #handleInit({ scopes }: MessageInit, ws: ServerWebSocket) {
    this.#clients.set(ws, scopes || [[]]);
    this.#emit({ ws });
  }

  async #handleAction({ action, payload }: MessageAction) {
    const mutate = this.#actions?.[action];
    if (!mutate) return;

    await mutate(this.#state.stream, payload);

    for (const ws of this.#clients.keys()) {
      this.#emit({ ws, patches: this.#state.sink });
    }
    this.#persist.append(this.#state.sink);
    this.#state.flush();
  }

  #emit({ ws, patches }: Emit) {
    const scopes = this.#clients.get(ws);
    return ws.send(
      pack({
        type: "emit",
        patches: patches
          ? patches.filter((patch) => {
              return scopes?.some((scope) => {
                return scope.every((c, i) => {
                  if (patch.path?.[i] === undefined) {
                    return true;
                  }
                  return c === patch.path[i];
                });
              });
            })
          : scopes?.map((c) => ({
              path: c,
              value: c.reduce((slice, p) => {
                return slice?.[p];
              }, this.#state.snap() as any),
            })),
      })
    );
  }
}
