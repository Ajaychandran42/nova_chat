import express from "express";
import http from "http";
import { Server } from "socket.io";
import { verifyToken } from "@clerk/backend";
import User from "../models/user.model.js";

const app = express();
const server = http.createServer(app);

const allowedOrigin = process.env.FRONTEND_URL || "http://localhost:5173";

const io = new Server(server, { cors: { origin: [allowedOrigin], credentials: true } });

function getReceiverSocketId(userId) {
  return userSocketMap[userId];
}

// online users map = { userId: socketId }
const userSocketMap = {};

// Relay a payload to another user's socket, tagging it with who it's from.
// Used for anything that shouldn't be persisted in the DB: typing status.
function relay(event) {
  return (socket) => (payload = {}) => {
    const { to, ...rest } = payload;
    const targetSocketId = getReceiverSocketId(to);
    if (!targetSocketId) return;

    io.to(targetSocketId).emit(event, { ...rest, from: socket.data.userId });
  };
}

// --- Socket handshake authentication ---------------------------------
//
// Previously the client just told us who it was (`?userId=...`) and we
// believed it — anyone could open a socket claiming to be any user's Mongo
// id, silently hijack their real-time delivery (their messages, reactions,
// read receipts would arrive at the attacker's socket instead), and show
// up "online" as them. This verifies the actual Clerk session token on
// every connection attempt instead, exactly like protectRoute does for
// HTTP requests, and resolves the userId from THAT, never from anything
// the client claims.
io.use(async (socket, next) => {
  try {
    const token = socket.handshake.auth?.token;
    if (!token || typeof token !== "string") {
      next(new Error("Unauthorized"));
      return;
    }

    const { sub: clerkId } = await verifyToken(token, {
      secretKey: process.env.CLERK_SECRET_KEY,
    });

    const user = await User.findOne({ clerkId }).select("_id");
    if (!user) {
      next(new Error("Unauthorized"));
      return;
    }

    socket.data.userId = String(user._id);
    next();
  } catch {
    next(new Error("Unauthorized"));
  }
});

io.on("connection", (socket) => {
  const userId = socket.data.userId;

  userSocketMap[userId] = socket.id;

  // io.emit() sends event to everyone - broadcast
  io.emit("getOnlineUsers", Object.keys(userSocketMap));

  // --- typing indicator ---
  socket.on("typing", relay("typing")(socket));
  socket.on("stopTyping", relay("stopTyping")(socket));

  // socket.on is used to listen for events
  socket.on("disconnect", () => {
    // only clear the map entry if it's still this socket's — an older,
    // already-superseded connection disconnecting shouldn't evict a
    // newer, still-live one for the same user
    if (userSocketMap[userId] === socket.id) delete userSocketMap[userId];
    io.emit("getOnlineUsers", Object.keys(userSocketMap));
  });
});

export { app, server, io, getReceiverSocketId };
