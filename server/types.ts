import type { ServerWebSocket } from "bun";

export type Input<S> = {
  [key: string]: S[keyof S] | InputActions<S>[keyof InputActions<S>];
} & S;
export type InputActions<S> = {
  [key: string]: InputAction<S> | InputActionAsync<S>;
  [key: `${string}Async`]: InputActionAsync<S>;
};
export type InputAction<S> = (draft: S, payload: any) => void;
export type InputActionAsync<S> = (payload: any) => Promise<(draft: S) => void>;

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

export type Clients = Map<ServerWebSocket, MessageInit["cursors"]>;
