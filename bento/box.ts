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
import State from "./state";
import Persist from "./persist";
import defu from "defu";
import { pack, unpack } from "msgpackr";
import {
  createApp,
  fromNodeMiddleware,
  defineWebSocketHandler,
  toWebHandler,
} from "h3";
import wsAdapter from "crossws/adapters/bun";
import { UserConfig, createServer } from "vite";

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

  run(viteConfig: UserConfig) {
    this.#state = new State<S>(this.config.state);
    this.#actions = this.config.actions;
    this.#persist = new Persist("bento.db");

    // replay patches
    this.#state.sink = this.#persist.patches();
    this.#state.flush();

    // collapse db
    this.#persist.clear();
    this.#persist.init(this.#state.snap());

    // apply defaults
    this.#handleActionStream((draft) => {
      defu(draft, this.config.state);
    });

    return this.#serve(viteConfig);
  }

  async #serve(viteConfig: UserConfig) {
    this.#clients = new Map();
    const app = createApp();

    // websocket server
    const wss = defineWebSocketHandler({
      message: (ws, msg: any) => {
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
    });
    app.use("/", wss);

    // vite dev server
    const vite = await createServer(
      defu(viteConfig, {
        build: { target: "chrome95" },
        server: { middlewareMode: true },
      })
    );
    app.use(fromNodeMiddleware(vite.middlewares));

    // serve
    const { handleUpgrade, websocket } = wsAdapter(app.websocket);
    const handleHttp = toWebHandler(app);
    return Bun.serve({
      port: 4400,
      websocket,
      async fetch(req, server) {
        if (await handleUpgrade(req, server)) {
          return;
        }
        return handleHttp(req);
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
