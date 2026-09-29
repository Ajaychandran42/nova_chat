import express from "express";
import {
  createGroup,
  deleteGroupMessage,
  enableGroupEncryption,
  getGroupMessages,
  getMyGroups,
  reactToGroupMessage,
  sendGroupMessage,
} from "../controllers/group.controller.js";
import { protectRoute } from "../middleware/auth.middleware.js";
import { upload } from "../middleware/upload.middleware.js";
import { sendMessageLimiter } from "../lib/rateLimiters.js";

const router = express.Router();

router.use(protectRoute);

router.get("/", getMyGroups);
router.post("/", createGroup);
router.get("/:groupId/messages", getGroupMessages);
router.put("/:groupId/keys", enableGroupEncryption);
router.post("/:groupId/messages", sendMessageLimiter, upload.single("media"), sendGroupMessage);
router.patch("/messages/react/:messageId", reactToGroupMessage);
router.delete("/messages/:messageId", deleteGroupMessage);

export default router;
