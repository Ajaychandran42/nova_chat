import express from "express";
import http from "http";
import { Server } from "socket.io";

const app = express();
const server = http.createServer(app);

const allowedOrigin = process.env.FRONTEND_URL || "http://localhost:5173";

const io = new Server(server, { cors: { origin: [allowedOrigin] } });

function getReceiverSocketId(userId) {
  return userSocketMap[userId];
}

// online users map = { userId: socketId }
const userSocketMap = {};

// Relay a payload to another user's socket, tagging it with who it's from.
// Used for anything that shouldn't be persisted in the DB: typing status and
// WebRTC call signaling (offer/answer/ICE candidates/hangup).
function relay(event) {
  return (socket) => (payload = {}) => {
    const { to, ...rest } = payload;
    const targetSocketId = getReceiverSocketId(to);
    if (!targetSocketId) return;

    io.to(targetSocketId).emit(event, { ...rest, from: socket.handshake.query.userId });
  };
}

io.on("connection", (socket) => {
  const userId = socket.handshake.query.userId;

  if (userId) userSocketMap[userId] = socket.id;

  // io.emit() sends event to everyone - broadcast
  io.emit("getOnlineUsers", Object.keys(userSocketMap));

  // --- typing indicator ---
  socket.on("typing", relay("typing")(socket));
  socket.on("stopTyping", relay("stopTyping")(socket));

  // --- WebRTC call signaling (audio + video) ---
  socket.on("call:invite", relay("call:invite")(socket));
  socket.on("call:offer", relay("call:offer")(socket));
  socket.on("call:answer", relay("call:answer")(socket));
  socket.on("call:ice-candidate", relay("call:ice-candidate")(socket));
  socket.on("call:reject", relay("call:reject")(socket));
  socket.on("call:end", relay("call:end")(socket));
  socket.on("call:busy", relay("call:busy")(socket));

  // socket.on is used to listen for events
  socket.on("disconnect", () => {
    if (userId) delete userSocketMap[userId];
    io.emit("getOnlineUsers", Object.keys(userSocketMap));
  });
});

export { app, server, io, getReceiverSocketId };
