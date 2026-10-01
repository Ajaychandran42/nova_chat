import express from "express";
import cors from "cors";
import helmet from "helmet";

import "dotenv/config";

import fs from "fs";
import path from "path";

import { clerkMiddleware } from "@clerk/express";

import User from "./models/user.model.js";
import { connectDB } from "./lib/db.js";
import { generalLimiter } from "./lib/rateLimiters.js";
import { sanitizeInputs } from "./middleware/sanitize.middleware.js";

import clerkWebhook from "./webhooks/clerk.webhook.js";
import authRoutes from "./routes/auth.route.js";
import messageRoutes from "./routes/message.route.js";
import groupRoutes from "./routes/group.route.js";
import { app, server } from "./lib/socket.js";

const PORT = Number(process.env.PORT) || 3000;
const FRONTEND_URL = process.env.FRONTEND_URL;
const isProduction = process.env.NODE_ENV === "production";

// Fail loudly instead of silently opening CORS to everyone: passing
// `origin: undefined` to the cors package does NOT mean "restrict to
// nothing" — in production that would be a real hole, not a safe default.
if (isProduction && !FRONTEND_URL) {
  console.error("FATAL: FRONTEND_URL must be set in production (needed to lock down CORS).");
  process.exit(1);
}

const publicDir = path.join(process.cwd(), "public");

// Security headers and no `X-Powered-By`. CSP is disabled because Clerk loads
// its authentication resources from an instance-specific external origin; a
// restrictive static policy here would break sign-in. Configure a tailored CSP
// at the proxy/CDN layer if one is required.
app.use(
  helmet({
    contentSecurityPolicy: false,
    crossOriginResourcePolicy: { policy: "cross-origin" }, // media is served to <img>/<video>/<audio> tags
  }),
);
app.disable("x-powered-by");

// it's important that you don't parse the webhook event data, it should be in the raw format
app.use("/api/webhooks/clerk", express.raw({ type: "application/json" }), clerkWebhook);

// Cap request body size — without this, nothing stops a client from
// sending a multi-gigabyte JSON body just to burn memory/CPU.
app.use(express.json({ limit: "2mb" }));
app.use(cors({ origin: FRONTEND_URL || "http://localhost:5173", credentials: true }));
app.use(sanitizeInputs);
app.use(generalLimiter);
app.use(clerkMiddleware());

app.get("/health", (req, res) => {
  res.status(200).json({ ok: true });
});

app.use("/api/auth", authRoutes);
app.use("/api/messages", messageRoutes);
app.use("/api/groups", groupRoutes);

// if the public directory exists, serve the static files
// this is for the production build
if (fs.existsSync(publicDir)) {
  app.use(express.static(publicDir));

  app.get("/{*any}", (req, res, next) => {
    res.sendFile(path.join(publicDir, "index.html"), (err) => next(err));
  });
}

// Catch-all error handler. Without this, an error thrown outside a route's
// own try/catch (a bad JSON body, a thrown middleware, etc.) falls through
// to Express's default handler, which — depending on NODE_ENV — can include
// the stack trace and internal file paths in the response. This always
// returns a plain, generic message instead; the real detail only ever goes
// to the server's own logs.
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  console.error("Unhandled error:", err);
  if (res.headersSent) return;
  const status = err.status || err.statusCode || 500;
  res.status(status).json({ message: status === 400 ? "Bad request" : "Internal server error" });
});

server.listen(PORT, () => {
  connectDB();
  console.log("Server is up and running on PORT:", PORT);
});
