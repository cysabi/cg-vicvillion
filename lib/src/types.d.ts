import type { Peer } from "crossws";
import type { defineWebSocketHandler } from "h3";

export type ServerConfig<S> =
  | S
  | {
      [key: string]: ServerConfigAction<S>;
    };
export type ServerConfigAction<S> = (
  set: (setter: Setter<S>) => void,
  payload?: any
) => Promise<void> | void;
export type Connect = (
  act: (action: string, payload?: any) => void
) => Promise<void> | void;

export type Setter<S> = (state: S) => void;
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
export type ServerWebSocket = Peer<unknown>;
export type Handler = Parameters<typeof defineWebSocketHandler>[0];

export type BentoBox<S extends Record<string, unknown>> = {
  config: ServerConfig<S>;
  uses: Connect[];
  controls: any[];
  use(connect: Connect): BentoBox<S>;
  control(control: any): BentoBox<S>;
};
