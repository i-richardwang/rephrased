import type { MiddlewareHandler } from "hono";

const TOKEN = process.env.API_TOKEN;

export const requireBearer: MiddlewareHandler = async (c, next) => {
  if (!TOKEN) {
    return c.json({ error: "server missing API_TOKEN" }, 500);
  }
  const header = c.req.header("authorization") ?? "";
  const expected = `Bearer ${TOKEN}`;
  if (header !== expected) {
    return c.json({ error: "unauthorized" }, 401);
  }
  await next();
};
