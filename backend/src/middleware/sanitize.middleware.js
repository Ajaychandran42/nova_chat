// Strips any object key that looks like a MongoDB query operator ($gt, $ne,
// $where, ...) or that contains a "." (used to reach into nested fields) out
// of req.body/params/query. This is what stops the classic NoSQL-injection
// trick of sending, say, { "email": { "$ne": null } } instead of a string,
// to make a query match everything instead of one specific document.
//
// Written by hand instead of pulling in express-mongo-sanitize: that
// package mutates req.query in place, which Express 5 makes a read-only
// getter, so it throws under this app's Express version. This walks the
// same object graphs but returns a new (or the same, if nothing changed)
// value rather than assigning back into req.query itself.
function isPlainObject(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function sanitizeValue(value, path, warnings) {
  if (Array.isArray(value)) return value.map((item) => sanitizeValue(item, path, warnings));
  if (!isPlainObject(value)) return value;

  const clean = {};
  for (const [key, val] of Object.entries(value)) {
    if (key.startsWith("$") || key.includes(".")) {
      warnings.push(`${path}.${key}`);
      continue;
    }
    clean[key] = sanitizeValue(val, `${path}.${key}`, warnings);
  }
  return clean;
}

export function sanitizeInputs(req, res, next) {
  const warnings = [];

  if (isPlainObject(req.body)) req.body = sanitizeValue(req.body, "body", warnings);
  if (isPlainObject(req.params)) {
    const clean = sanitizeValue(req.params, "params", warnings);
    for (const key of Object.keys(req.params)) req.params[key] = clean[key];
  }
  if (req.query && isPlainObject(req.query)) {
    const clean = sanitizeValue(req.query, "query", warnings);
    for (const key of Object.keys(req.query)) {
      if (!(key in clean)) delete req.query[key];
      else req.query[key] = clean[key];
    }
  }

  if (warnings.length > 0) {
    console.warn(`Blocked suspicious operator-shaped input from ${req.ip}:`, warnings.join(", "));
  }

  next();
}
