import rateLimit, { ipKeyGenerator } from "express-rate-limit";

// A quiet ceiling on every request, mainly to blunt basic
// denial-of-service/scraping attempts. Real, large-scale DDoS protection
// happens upstream of this process (Cloudflare, a cloud load balancer,
// etc.) — no single Node process can absorb a genuinely large flood by
// itself, so this is one layer, not the whole defense.
export const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 500,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: "Too many requests — please slow down." },
});

// Sending messages/media is the most abuse-prone action (spam, storage
// exhaustion via uploads) so it gets its own tighter budget.
export const sendMessageLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 100,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => req.user?._id?.toString() || ipKeyGenerator(req.ip),
  message: { message: "You're sending messages too quickly — please slow down." },
});
