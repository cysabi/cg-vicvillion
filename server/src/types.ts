import type { ServerWebSocket as WS } from "bun";

export type Input<S> = {
  [key: string]: S[keyof S] | InputAction<S>;
} & S;
export type InputAction<S> = (
  stream: (cb: (state: S) => void) => void,
  payload: unknown
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
