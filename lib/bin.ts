import { defineCommand, runMain } from "citty";
import {
  createApp,
  defineWebSocketHandler,
  fromNodeMiddleware,
  toWebHandler,
} from "h3";
import wsAdapter from "crossws/adapters/bun";
import { createServer as createViteServer } from "vite";
import BentoServer from "./src/server/index";
import type { BentoBox } from "./src/types";

const importBentoBox = async (config: string) => {
  return (
    await import(Bun.pathToFileURL(Bun.resolveSync(`./${config}`, ".")).href)
  ).default;
};

const command = defineCommand({
  meta: {
    name: "bento",
    description: "Run BentoBox",
  },
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
  subCommands: () => ({
    dev: {
      async run({ args }) {
        const bentoBox = (await importBentoBox(
          args["config"] || "bento.box"
        )) as BentoBox<any>;
        const app = createApp();

        // websocket server
        const bentoServer = new BentoServer(bentoBox.config);
        bentoBox.uses.forEach((use) => {
          bentoServer.use(use);
        });
        app.use("/_ws", defineWebSocketHandler(bentoServer.handler));

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

runMain(command);
