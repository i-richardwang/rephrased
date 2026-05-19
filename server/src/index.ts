import { serve } from "@hono/node-server";
import { serveStatic } from "@hono/node-server/serve-static";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import cardsRoute from "./routes/cards.js";
import lexiconRoute from "./routes/lexicon.js";
import transcriptsRoute from "./routes/transcripts.js";
import { recoverPending } from "./worker/queue.js";

const app = new Hono();

app.use("*", logger());
app.use("*", cors());

app.route("/api/cards", cardsRoute);
app.route("/api/transcripts", transcriptsRoute);
app.route("/api/lexicon", lexiconRoute);

app.get("/api/health", (c) => c.json({ status: "ok" }));

app.use("/*", serveStatic({ root: "../web/dist" }));
app.use("/*", serveStatic({ root: "../web/dist", path: "index.html" }));

const port = Number(process.env.PORT) || 8000;
console.log(`listening on :${port}`);
serve({ fetch: app.fetch, port });

recoverPending().catch((err) =>
  console.error("[startup] recoverPending failed:", err),
);
