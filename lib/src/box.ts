import type { Actions, ServerConfig } from "./types";
import {
  createApp,
  defineWebSocketHandler,
  fromNodeMiddleware,
  toWebHandler,
} from "h3";
// import wsAdapter from "crossws/adapters/node";
import wsAdapter from "crossws/adapters/bun";
import { toNodeListener } from "h3";
import { createServer } from "node:http";
import { createServer as createViteServer } from "vite";
import { Server as BentoServer } from "./server";

export type BentoBoxModel<S> = S | Actions<S>;

export const box = async <S extends Record<string, unknown>>(
  model: BentoBoxModel<S>,
  init?: (act: (action: string, payload: any) => void) => void
) => {
  const config: ServerConfig<S> = {
    state: {} as S,
    actions: {},
  };

  Object.entries(model).forEach(([key, value]) => {
    // TODO: deep search for an external lib
    if (typeof value === "function") {
      config.actions[key] = value as Actions<S>[keyof Actions<S>];
    } else {
      config.state[key as keyof S] = value as S[keyof S];
    }
  });

  const app = createApp();

  // vite dev server
  const vite = await createViteServer({
    server: { middlewareMode: true },
    build: { target: "chrome95" },
  });
  app.use(fromNodeMiddleware(vite.middlewares));

  // websocket server
  const server = new BentoServer(config);
  if (init) init(server.act.bind(server));
  app.use("/_ws", defineWebSocketHandler(server.wss));

  // serve
  // const nodeServer = createServer(toNodeListener(app)).listen(4400);
  // const { handleUpgrade } = wsAdapter(app.websocket);
  // nodeServer.on("upgrade", handleUpgrade);

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
};