import { pack, unpack } from "msgpackr";
import State from "./state";
import Persist from "./persist";
import type {
  InputActionAsync,
  InputActions,
  Message,
  MessageInit,
  InputAction,
  Input,
  MessageAction,
  Emit,
  Clients,
  WebSocketHandler,
  ServerWebSocket,
} from "./types";

export default class BunCG<S extends Record<string, any>> {
  #state: State<S>;
  #actions: InputActions<S> = {};
  #persist;
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
    this.#handleActionDispatch(serverAction);
  }

  constructor(input: Input<S>, options = { db: "buncg.state" }) {
    Object.entries(input).filter(([key, value]) => {
      if (typeof value === "function") {
        delete input[key];
        this.#actions[key] = value as InputAction<S>;
      }
    });
    this.#state = new State<S>(input);
    this.#persist = new Persist(options.db);

    this.#state.sink = this.#persist.patches().asArray;
    this.#state.flush();

    this.#persist.clear();
    this.#persist.init(this.#state.snap());

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
      mutateAsync(payload).then((m) => this.#handleActionDispatch(m));
    } else {
      this.#handleActionDispatch(mutate, payload);
    }
  }
  #handleActionDispatch(dispatch: InputAction<S>, payload?: any) {
    this.#state.withStream((draft) => {
      dispatch(draft, payload);
    });

    for (const ws of this.#clients.keys()) {
      this.#emit({ ws, patches: this.#state.sink });
    }
    this.#persist.append(this.#state.sink);
    this.#state.flush();
  }

  #emit({ ws, patches }: Emit) {
    const cursors = this.#clients.get(ws);
    return ws.send(
      pack({
        type: "emit",
        patches: patches
          ? patches.filter((patch) => {
              return cursors?.some((cursor) => {
                return cursor.every((c, i) => {
                  if (patch.path?.[i] === undefined) {
                    return true;
                  }
                  return c === patch.path[i];
                });
              });
            })
          : cursors?.map((c) => ({
              path: c,
              value: c.reduce((slice, p) => {
                return slice?.[p];
              }, this.#state.snap()),
            })),
      })
    );
  }
}
