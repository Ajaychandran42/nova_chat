import express from "express";
import {
  deleteMessage,
  getConversationsForSidebar,
  getMessages,
  getUsersForSidebar,
  reactToMessage,
  sendMessage,
} from "../controllers/message.controller.js";
import { protectRoute } from "../middleware/auth.middleware.js";
import { upload } from "../middleware/upload.middleware.js";

const router = express.Router();

router.use(protectRoute);

router.get("/users", getUsersForSidebar);
router.get("/conversations", getConversationsForSidebar);
router.get("/:id", getMessages);
router.post("/send/:id", upload.single("media"), sendMessage);
router.patch("/react/:messageId", reactToMessage);
router.delete("/:messageId", deleteMessage);

export default router;
