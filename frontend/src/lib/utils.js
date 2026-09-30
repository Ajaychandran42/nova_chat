export function formatMessageTime(date) {
  return new Date(date).toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit",
  });
}

// Deterministic "colorful initials avatar" palette, like Nova/Slack/Discord style
// contact lists — the same person always lands on the same color.
const AVATAR_PALETTE = [
  { bg: "bg-rose-500", text: "text-white" },
  { bg: "bg-blue-500", text: "text-white" },
  { bg: "bg-emerald-500", text: "text-white" },
  { bg: "bg-amber-500", text: "text-white" },
  { bg: "bg-violet-500", text: "text-white" },
  { bg: "bg-cyan-500", text: "text-white" },
  { bg: "bg-pink-500", text: "text-white" },
  { bg: "bg-indigo-500", text: "text-white" },
];

export function getAvatarPalette(seed = "") {
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) {
    hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  }
  return AVATAR_PALETTE[hash % AVATAR_PALETTE.length];
}
