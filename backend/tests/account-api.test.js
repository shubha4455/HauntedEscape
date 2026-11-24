import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createServer } from "node:net";
import { mkdtempSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { after, before, test } from "node:test";
import { setTimeout as delay } from "node:timers/promises";
import { fileURLToPath } from "node:url";

const backendDirectory = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
let apiProcess;
let apiUrl;
let temporaryDirectory;
let processOutput = "";

async function getAvailablePort() {
  const server = createServer();
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  const { port } = server.address();
  await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  return port;
}

before(async () => {
  temporaryDirectory = mkdtempSync(path.join(os.tmpdir(), "haunted-escape-api-"));
  const port = await getAvailablePort();
  apiUrl = `http://127.0.0.1:${port}/api`;
  apiProcess = spawn(process.execPath, [path.join(backendDirectory, "server.js")], {
    cwd: backendDirectory,
    env: {
      ...process.env,
      PORT: String(port),
      JWT_SECRET: "test-only-secret-with-more-than-32-characters",
      DB_PATH: path.join(temporaryDirectory, "test.sqlite"),
      ALLOWED_ORIGINS: "http://localhost:5173",
    },
    stdio: ["ignore", "pipe", "pipe"],
  });
  apiProcess.stdout.on("data", (chunk) => { processOutput += chunk.toString(); });
  apiProcess.stderr.on("data", (chunk) => { processOutput += chunk.toString(); });

  for (let attempt = 0; attempt < 50; attempt += 1) {
    if (apiProcess.exitCode !== null) {
      throw new Error(`Account API exited before starting:\n${processOutput}`);
    }

    try {
      const response = await fetch(`${apiUrl}/health`);
      if (response.ok) return;
    } catch (error) {
      if (attempt === 49) throw error;
    }

    await delay(100);
  }

  throw new Error(`Account API did not become ready:\n${processOutput}`);
});

after(async () => {
  if (apiProcess && apiProcess.exitCode === null) {
    apiProcess.kill();
    await new Promise((resolve) => apiProcess.once("exit", resolve));
  }
  if (temporaryDirectory) {
    rmSync(temporaryDirectory, { recursive: true, force: true });
  }
});

test("accounts register, authenticate, and sync escape records", async () => {
  const weakPasswordResponse = await fetch(`${apiUrl}/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email: "player@example.com",
      displayName: "Raven",
      password: "short",
    }),
  });
  assert.equal(weakPasswordResponse.status, 400);

  const registerResponse = await fetch(`${apiUrl}/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email: "Player@example.com",
      displayName: "Raven",
      password: "a-secure-test-password",
    }),
  });
  assert.equal(registerResponse.status, 201);
  const registered = await registerResponse.json();
  assert.equal(registered.account.email, "player@example.com");
  assert.equal(registered.account.displayName, "Raven");
  assert.equal(registered.account.bestTime, null);
  assert.equal("password_hash" in registered.account, false);

  const duplicateResponse = await fetch(`${apiUrl}/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email: "player@example.com",
      displayName: "Raven",
      password: "a-secure-test-password",
    }),
  });
  assert.equal(duplicateResponse.status, 409);

  const loginResponse = await fetch(`${apiUrl}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email: "PLAYER@example.com",
      password: "a-secure-test-password",
    }),
  });
  assert.equal(loginResponse.status, 200);
  const loggedIn = await loginResponse.json();

  const unauthenticatedResponse = await fetch(`${apiUrl}/account`);
  assert.equal(unauthenticatedResponse.status, 401);

  const headers = { Authorization: `Bearer ${loggedIn.token}` };
  const profileResponse = await fetch(`${apiUrl}/account`, { headers });
  assert.equal(profileResponse.status, 200);
  assert.equal((await profileResponse.json()).account.escapeCount, 0);

  const invalidEscapeResponse = await fetch(`${apiUrl}/account/escapes`, {
    method: "POST",
    headers: { ...headers, "Content-Type": "application/json" },
    body: JSON.stringify({ remainingSeconds: 241 }),
  });
  assert.equal(invalidEscapeResponse.status, 400);

  const firstEscapeResponse = await fetch(`${apiUrl}/account/escapes`, {
    method: "POST",
    headers: { ...headers, "Content-Type": "application/json" },
    body: JSON.stringify({ remainingSeconds: 137 }),
  });
  assert.equal(firstEscapeResponse.status, 200);
  assert.deepEqual((await firstEscapeResponse.json()).account, {
    ...registered.account,
    bestTime: 137,
    escapeCount: 1,
  });

  const secondEscapeResponse = await fetch(`${apiUrl}/account/escapes`, {
    method: "POST",
    headers: { ...headers, "Content-Type": "application/json" },
    body: JSON.stringify({ remainingSeconds: 100 }),
  });
  const updatedAccount = (await secondEscapeResponse.json()).account;
  assert.equal(updatedAccount.bestTime, 137);
  assert.equal(updatedAccount.escapeCount, 2);
});
