import "dotenv/config";
import bcrypt from "bcryptjs";
import cors from "cors";
import Database from "better-sqlite3";
import express from "express";
import { rateLimit } from "express-rate-limit";
import helmet from "helmet";
import jwt from "jsonwebtoken";
import { mkdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const databasePath = process.env.DB_PATH || path.join(here, "data", "haunted-escape.sqlite");
const jwtSecret = process.env.JWT_SECRET;
const allowedOrigins = (process.env.ALLOWED_ORIGINS || "http://localhost:5173,http://127.0.0.1:5173,http://127.0.0.1:4175")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

if (!jwtSecret || jwtSecret.length < 32) {
  throw new Error("JWT_SECRET must be set to a random value of at least 32 characters.");
}

mkdirSync(path.dirname(databasePath), { recursive: true });

const database = new Database(databasePath);
database.pragma("journal_mode = WAL");
database.exec(`
  CREATE TABLE IF NOT EXISTS accounts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT NOT NULL UNIQUE,
    display_name TEXT NOT NULL,
    password_hash TEXT NOT NULL,
    best_time INTEGER,
    escape_count INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  )
`);

const findAccountByEmail = database.prepare("SELECT * FROM accounts WHERE email = ?");
const findAccountById = database.prepare("SELECT * FROM accounts WHERE id = ?");
const createAccount = database.prepare(
  "INSERT INTO accounts (email, display_name, password_hash) VALUES (?, ?, ?)"
);
const recordEscape = database.prepare(`
  UPDATE accounts
  SET best_time = CASE WHEN best_time IS NULL OR best_time < ? THEN ? ELSE best_time END,
      escape_count = escape_count + 1
  WHERE id = ?
`);

const app = express();
app.disable("x-powered-by");
app.set("trust proxy", 1);
app.use(helmet());
app.use(cors({
  origin(origin, callback) {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
      return;
    }
    callback(new Error("This website is not allowed to use the account API."));
  },
}));
app.use(express.json({ limit: "10kb" }));

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: { error: "Too many account attempts. Please wait a few minutes and try again." },
});

function publicAccount(account) {
  return {
    id: account.id,
    email: account.email,
    displayName: account.display_name,
    bestTime: account.best_time,
    escapeCount: account.escape_count,
  };
}

function issueToken(accountId) {
  return jwt.sign({ sub: String(accountId) }, jwtSecret, { expiresIn: "7d" });
}

function requireAccount(request, response, next) {
  const authorization = request.get("authorization") || "";
  const [scheme, token] = authorization.split(" ");

  if (scheme !== "Bearer" || !token) {
    response.status(401).json({ error: "Sign in to access your account." });
    return;
  }

  let payload;
  try {
    payload = jwt.verify(token, jwtSecret);
  } catch (error) {
    if (error instanceof jwt.JsonWebTokenError || error instanceof jwt.TokenExpiredError) {
      response.status(401).json({ error: "Your session expired. Please sign in again." });
      return;
    }
    next(error);
    return;
  }

  const account = findAccountById.get(Number(payload.sub));
  if (!account) {
    response.status(401).json({ error: "This account session is no longer valid. Please sign in again." });
    return;
  }
  request.account = account;
  next();
}

app.get("/api/health", (_request, response) => {
  response.json({ status: "ok" });
});

app.post("/api/auth/register", authLimiter, async (request, response, next) => {
  const email = typeof request.body.email === "string" ? request.body.email.trim().toLowerCase() : "";
  const displayName = typeof request.body.displayName === "string"
    ? request.body.displayName.trim()
    : "";
  const password = typeof request.body.password === "string" ? request.body.password : "";

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) {
    response.status(400).json({ error: "Enter a valid email address." });
    return;
  }
  if (displayName.length < 2 || displayName.length > 24) {
    response.status(400).json({ error: "Display name must be 2–24 characters." });
    return;
  }
  if (password.length < 10 || password.length > 128) {
    response.status(400).json({ error: "Password must be 10–128 characters." });
    return;
  }
  if (findAccountByEmail.get(email)) {
    response.status(409).json({ error: "An account with that email already exists." });
    return;
  }

  try {
    const passwordHash = await bcrypt.hash(password, 12);
    const result = createAccount.run(email, displayName, passwordHash);
    const account = findAccountById.get(Number(result.lastInsertRowid));
    response.status(201).json({ token: issueToken(account.id), account: publicAccount(account) });
  } catch (error) {
    if (error.code === "SQLITE_CONSTRAINT_UNIQUE") {
      response.status(409).json({ error: "An account with that email already exists." });
      return;
    }
    next(error);
  }
});

app.post("/api/auth/login", authLimiter, async (request, response, next) => {
  const email = typeof request.body.email === "string" ? request.body.email.trim().toLowerCase() : "";
  const password = typeof request.body.password === "string" ? request.body.password : "";
  const account = findAccountByEmail.get(email);

  if (!account || !(await bcrypt.compare(password, account.password_hash))) {
    response.status(401).json({ error: "Email or password is incorrect." });
    return;
  }

  try {
    response.json({ token: issueToken(account.id), account: publicAccount(account) });
  } catch (error) {
    next(error);
  }
});

app.get("/api/account", requireAccount, (request, response) => {
  response.json({ account: publicAccount(request.account) });
});

app.post("/api/account/escapes", requireAccount, (request, response) => {
  const remainingSeconds = request.body.remainingSeconds;
  if (!Number.isInteger(remainingSeconds) || remainingSeconds < 0 || remainingSeconds > 240) {
    response.status(400).json({ error: "Escape time must be between 0 and 240 seconds." });
    return;
  }

  recordEscape.run(remainingSeconds, remainingSeconds, request.account.id);
  response.json({ account: publicAccount(findAccountById.get(request.account.id)) });
});

app.use((error, _request, response, _next) => {
  console.error(error);
  if (error.message === "This website is not allowed to use the account API.") {
    response.status(403).json({ error: error.message });
    return;
  }
  response.status(500).json({ error: "The account service encountered an error. Please try again." });
});

const port = Number(process.env.PORT) || 3001;
app.listen(port, "0.0.0.0", () => {
  console.log(`Haunted Escape API listening on port ${port}`);
});
