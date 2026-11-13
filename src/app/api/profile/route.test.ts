import { afterEach, describe, expect, it, vi } from "vitest";
import { POST } from "./route";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("POST /api/profile", () => {
  it("rejects invalid profile data without calling the remote service", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const response = await POST(
      new Request("http://localhost/api/profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "Jordan 2", location: "New York" }),
      }),
    );

    expect(response.status).toBe(400);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("forwards valid profile fields and returns the service response", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      Response.json({ SUCCESS: "Added Jordan Lee from New York" }),
    );
    vi.stubGlobal("fetch", fetchMock);
    const response = await POST(
      new Request("http://localhost/api/profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: " Jordan Lee ", location: " New York " }),
      }),
    );

    expect(response.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledWith(
      "https://us-central1-frontend-simplified.cloudfunctions.net/skinstricPhaseOne",
      expect.objectContaining({ body: JSON.stringify({ name: "Jordan Lee", location: "New York" }) }),
    );
  });
});
