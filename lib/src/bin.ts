import { defineCommand, runMain } from "citty";
import {
  createApp,
  defineWebSocketHandler,
  fromNodeMiddleware,
  toWebHandler,
} from "h3";
import wsAdapter from "crossws/adapters/bun";
import { createServer as createViteServer } from "vite";
import { Server as BentoServer } from "./server";
import type { ServerConfig } from "./types";

const command = defineCommand({
  meta: { name: "bento" },
  subCommands: () => ({
    dev: {
      args: {
        config: {
          type: "string",
          description: "Path to config file (defaults to 'bento.box.js')",
        },
        port: {
          type: "string",
          description: "Port to listen on (defaults to '4400')",
        },
      },
      async run({ args }) {
        const config = await importBentoBox(args["config"] || "bento.box");
        const app = createApp();

        // websocket server
        const bento = new BentoServer(config);
        app.use("/_ws", defineWebSocketHandler(bento.wss));

        // vite dev server
        const vite = await createViteServer({
          server: { middlewareMode: true },
          build: { target: "chrome95" },
        });
        app.use(fromNodeMiddleware(vite.middlewares));

        // serve
        const { handleUpgrade, websocket } = wsAdapter(app.websocket);
        const handleHttp = toWebHandler(app);
        return Bun.serve({
          port: args["port"] || 4400,
          websocket,
          async fetch(req, server) {
            if (await handleUpgrade(req, server)) {
              return;
            }
            return handleHttp(req);
          },
        });
      },
    },
  }),
});

const importBentoBox = async (
  config: string
): Promise<ServerConfig<Record<string, unknown>>> => {
  return (
    await import(Bun.pathToFileURL(Bun.resolveSync(`./${config}`, ".")).href)
  ).default;
};

runMain(command);
