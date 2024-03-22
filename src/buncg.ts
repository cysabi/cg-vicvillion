import type { ServerWebSocket, WebSocketHandler } from "bun";
import { fromJS } from "immutable";

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

export default class BunCG<S extends Record<string, any>> {
  state;
  actions;
  watchers: Watcher[];
  websocket: WebSocketHandler;

  constructor(model: Input<S>) {
    this.state = fromJS(model.state);
    this.actions = model.actions;
    this.watchers = [];
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

  handleAction({ action, payload }: MessageAction) {
    const mutate = this.actions?.[action];
    if (!mutate) return;
    if (action.endsWith("Async")) {
      const mutateAsync = mutate as InputActionAsync<S>;
      mutateAsync(payload).then((m) => this.handleActionMutate(m));
    } else {
      this.handleActionMutate(mutate, payload);
    }
  }

  handleActionMutate(mutate: InputAction<S>, payload?: any) {
    const mutated = this.state.withMutations((draft) => mutate(draft, payload));

    // queue events
    const events: Emit[] = [];
    this.watchers.forEach(({ ws, id, cursor }) => {
      const state = mutated.getIn(cursor);
      if (state !== this.state.getIn(cursor)) {
        events.push({ ws, id, state });
      }
    });

    // set new state, then emit queued events
    this.state = mutated;
    events.forEach((e) => this.emit(e));
  }

  handleWatch({ id, cursor }: MessageWatch, ws: ServerWebSocket) {
    this.watchers.push({ ws, id, cursor });
    this.emit({ ws, id, state: this.state.getIn(cursor) });
  }

  handleUnwatch({ id }: MessageWatch) {
    this.watchers = this.watchers.filter((watcher) => !(watcher.id === id));
  }

  emit({ ws, id, state }: Emit) {
    ws.send(
      JSON.stringify({
        type: "emit",
        id,
        state,
      })
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
