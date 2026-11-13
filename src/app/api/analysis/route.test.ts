import { afterEach, describe, expect, it, vi } from "vitest";
import { POST } from "./route";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("POST /api/analysis", () => {
  it("rejects non-Base64 image data without calling the remote service", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const response = await POST(
      new Request("http://localhost/api/analysis", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image: "not base64!" }),
      }),
    );

    expect(response.status).toBe(400);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("sends a valid Base64 image using the required API field", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      Response.json({ message: "Analysis complete.", data: { race: {}, age: {}, gender: {} } }),
    );
    vi.stubGlobal("fetch", fetchMock);
    const response = await POST(
      new Request("http://localhost/api/analysis", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image: "c2FtcGxl" }),
      }),
    );

    expect(response.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledWith(
      "https://us-central1-frontend-simplified.cloudfunctions.net/skinstricPhaseTwo",
      expect.objectContaining({ body: JSON.stringify({ image: "c2FtcGxl" }) }),
    );
  });

  it("accepts a maximum-size Base64 payload without overflowing validation", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      Response.json({ message: "Analysis complete.", data: { race: {}, age: {}, gender: {} } }),
    );
    vi.stubGlobal("fetch", fetchMock);
    const image = "A".repeat(14_000_000);
    const response = await POST(
      new Request("http://localhost/api/analysis", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image }),
      }),
    );

    expect(response.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledOnce();
  });
});
