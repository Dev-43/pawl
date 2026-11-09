import { describe, it, expect, vi, beforeEach } from "vitest";
import { GET, PUT } from "../src/app/api/rules/route";
import { NextRequest } from "next/server";
import { createApproverToken, APPROVER_COOKIE_NAME } from "../src/lib/auth/approver";

describe("Rule Config Storage and Approver Edits API (Task 2.4)", () => {
  beforeEach(() => {
    process.env.SESSION_SECRET = "test-session-secret-at-least-32-chars-long";
  });

  it("GET /api/rules returns current config publicly", async () => {
    const res = await GET();
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.perCallCapUsd).toBeDefined();
    expect(body.dailyBudgetUsd).toBeDefined();
    expect(body.allowedCurrencies).toContain("USD");
  }, 15000);

  it("PUT /api/rules returns 401 when unauthenticated", async () => {
    const req = new NextRequest("http://localhost:3000/api/rules", {
      method: "PUT",
      body: JSON.stringify({ perCallCapUsd: 100 }),
    });

    const res = await PUT(req);
    expect(res.status).toBe(401);

    const body = await res.json();
    expect(body.error.code).toBe("UNAUTHORIZED");
  });

  it("PUT /api/rules succeeds and persists when authenticated with valid approver session", async () => {
    const validToken = createApproverToken();
    const req = new NextRequest("http://localhost:3000/api/rules", {
      method: "PUT",
      headers: {
        cookie: `${APPROVER_COOKIE_NAME}=${validToken}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        perCallCapUsd: 75.0,
        dailyBudgetUsd: 250.0,
      }),
    });

    const res = await PUT(req);
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.perCallCapUsd).toBe(75.0);
    expect(body.dailyBudgetUsd).toBe(250.0);
  }, 15000);
});
