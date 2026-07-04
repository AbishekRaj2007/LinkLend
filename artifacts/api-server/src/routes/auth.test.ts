import { describe, it, expect, afterAll } from "vitest";
import request from "supertest";
import { eq } from "drizzle-orm";
import { db, users } from "@workspace/db";
import app from "../app";

const KNOWN_ID = "MSME-000004";
const UNKNOWN_ID = "MSME-999999";

// No test-DB isolation exists in this repo — these hit the real dev DB, so
// use unique emails per run and clean up what we insert.
const runId = Date.now();
const emailsToCleanUp: string[] = [];
function uniqueEmail(label: string): string {
  const email = `auth-test-${label}-${runId}@example.com`;
  emailsToCleanUp.push(email);
  return email;
}

afterAll(async () => {
  for (const email of emailsToCleanUp) {
    await db.delete(users).where(eq(users.email, email));
  }
});

describe("POST /api/auth/signup", () => {
  it("signs up a lender with no msme_id", async () => {
    const email = uniqueEmail("lender");
    const res = await request(app)
      .post("/api/auth/signup")
      .send({ email, password: "correct-horse-1", name: "Lender", role: "lender" });

    expect(res.status).toBe(201);
    expect(res.body.user.role).toBe("lender");
    expect(res.body.user.msme_id).toBeUndefined();
  });

  it("signs up a borrower with a valid msme_id", async () => {
    const email = uniqueEmail("borrower-valid");
    const res = await request(app).post("/api/auth/signup").send({
      email,
      password: "correct-horse-1",
      name: "Borrower",
      role: "borrower",
      msme_id: KNOWN_ID,
    });

    expect(res.status).toBe(201);
    expect(res.body.user.role).toBe("borrower");
    expect(res.body.user.msme_id).toBe(KNOWN_ID);
  });

  it("normalizes a lowercase/whitespace-padded msme_id at signup", async () => {
    const email = uniqueEmail("borrower-normalize");
    const res = await request(app).post("/api/auth/signup").send({
      email,
      password: "correct-horse-1",
      name: "Borrower",
      role: "borrower",
      msme_id: `  ${KNOWN_ID.toLowerCase()}  `,
    });

    expect(res.status).toBe(201);
    expect(res.body.user.msme_id).toBe(KNOWN_ID);
  });

  it("rejects a borrower signup missing msme_id", async () => {
    const email = uniqueEmail("borrower-missing");
    const res = await request(app).post("/api/auth/signup").send({
      email,
      password: "correct-horse-1",
      name: "Borrower",
      role: "borrower",
    });

    expect(res.status).toBe(400);
  });

  it("rejects a borrower signup with an unknown msme_id", async () => {
    const email = uniqueEmail("borrower-unknown");
    const res = await request(app).post("/api/auth/signup").send({
      email,
      password: "correct-horse-1",
      name: "Borrower",
      role: "borrower",
      msme_id: UNKNOWN_ID,
    });

    expect(res.status).toBe(400);
  });

  it("rejects a signup missing role", async () => {
    const email = uniqueEmail("no-role");
    const res = await request(app)
      .post("/api/auth/signup")
      .send({ email, password: "correct-horse-1", name: "No Role" });

    expect(res.status).toBe(400);
  });
});

describe("POST /api/auth/login", () => {
  it("threads role and msme_id through on login", async () => {
    const email = uniqueEmail("login-borrower");
    const password = "correct-horse-1";
    await request(app).post("/api/auth/signup").send({
      email,
      password,
      name: "Borrower",
      role: "borrower",
      msme_id: KNOWN_ID,
    });

    const res = await request(app)
      .post("/api/auth/login")
      .send({ email, password });

    expect(res.status).toBe(200);
    expect(res.body.user.role).toBe("borrower");
    expect(res.body.user.msme_id).toBe(KNOWN_ID);
  });
});
