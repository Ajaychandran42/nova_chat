import multer from "multer";

const MAX_FILE_SIZE = 25 * 1024 * 1024; // 25mb

export const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_FILE_SIZE },
  fileFilter: (req, file, cb) => {
    const isImage = file.mimetype.startsWith("image/");
    const isVideo = file.mimetype.startsWith("video/");
    const isAudio = file.mimetype.startsWith("audio/");
    // End-to-end encrypted media is uploaded as an opaque blob — the server
    // (and CDN) can't tell what's inside, which is the point.
    const isEncryptedBlob = file.mimetype === "application/octet-stream";

    if (!isImage && !isVideo && !isAudio && !isEncryptedBlob) {
      cb(new Error("Only image, video, and audio uploads are allowed"));
      return;
    }

    cb(null, true);
  },
});
