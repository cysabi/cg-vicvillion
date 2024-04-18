import type { ServerWebSocket as WS } from "bun";

export type Input<S> =
  | S
  | {
      [key: string]: InputAction<S>;
    };
export type InputAction<S> = (
  set: Set<S>,
  payload?: any
) => Promise<void> | void;
export type Set<S> = (setter: Setter<S>) => void;
export type Setter<S> = (state: S) => void;

export type Connect = (
  act: (action: string, payload?: any) => void
) => Promise<void> | void;

export type Patch = { path: string[]; value?: any };
export type Message =
  | ({ type: "init" } & MessageInit)
  | ({ type: "action" } & MessageAction);
export type MessageInit = {
  scopes: Patch["path"][];
};
export type MessageAction = {
  action: string;
  payload: any;
};
export type Emit = {
  ws: ServerWebSocket;
  patches?: Patch[];
};

export type Clients = Map<ServerWebSocket, MessageInit["scopes"]>;
export type ServerWebSocket = WS<unknown>;

export type { WebSocketHandler } from "bun";
