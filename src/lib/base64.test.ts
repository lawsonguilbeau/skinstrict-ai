import { describe, expect, it } from "vitest";
import { isBase64 } from "./base64";

describe("isBase64", () => {
  it("accepts valid padded and unpadded Base64", () => {
    expect(isBase64("c2FtcGxl")).toBe(true);
    expect(isBase64("YQ==")).toBe(true);
    expect(isBase64("YWI=")).toBe(true);
  });

  it("rejects malformed padding and invalid characters", () => {
    expect(isBase64("Y===")).toBe(false);
    expect(isBase64("Y=Q=")).toBe(false);
    expect(isBase64("not base64!")).toBe(false);
  });

  it("validates a large payload without regex stack overflow", () => {
    expect(isBase64("A".repeat(14_000_000))).toBe(true);
  });
});
