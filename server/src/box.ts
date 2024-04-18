import { pack, unpack } from "msgpackr";
import State from "./state";
import Persist from "./persist";
import type {
  Message,
  InputAction,
  Input,
  Emit,
  Clients,
  ServerWebSocket,
  Connect,
  Setter,
} from "./types";

export default class BentoBox<S extends Record<string, unknown>> {
  config: {
    state: S;
    actions: Record<string, InputAction<S>>;
  };

  #state!: State<S>;
  #actions!: { [key: string]: InputAction<S> };
  #persist!: Persist<S>;
  #clients!: Clients;

  constructor(input: Input<S>) {
    this.config = {
      actions: {},
      state: {} as S,
    };
    // TODO: deep search for an external lib
    Object.entries(input).filter(([key, value]) => {
      if (typeof value === "function") {
        delete input[key];
        this.config.actions[key] = value as InputAction<S>;
      }
    });
    this.config.state = input as S;
  }

  use(connect: Connect) {
    connect(this.#handleAction);
  }

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
              return this.#handleInit(data.scopes, ws);
            case "action":
              return this.#handleAction(data.action, data.payload);
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

  #handleInit(scopes: string[][], ws: ServerWebSocket) {
    this.#clients.set(ws, scopes || [[]]);
    this.#emit({ ws });
  }

  #handleAction(action: string, payload: any) {
    const mutate = this.#actions?.[action];
    if (!mutate) return; // TODO: handle this?
    mutate(this.#handleActionStream, payload);
  }
  #handleActionStream(setter: Setter<S>) {
    try {
      this.#state.stream(setter);
      for (const ws of this.#clients.keys()) {
        this.#emit({ ws, patches: this.#state.sink });
      }
      this.#persist.append(this.#state.sink);
      this.#state.flush();
    } finally {
      // TODO: error handling?
      this.#state.flush(false);
    }
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
              value: c.reduce((slice: any, p) => {
                return slice?.[p];
              }, this.#state.snap()),
            })),
      })
    );
  }
}
