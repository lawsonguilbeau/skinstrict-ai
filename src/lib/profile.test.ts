import { describe, expect, it } from "vitest";
import { validateProfile, validateProfileField } from "./profile";

describe("validateProfile", () => {
  it("accepts non-empty names and locations without digits", () => {
    expect(validateProfile({ name: "Jordan Lee", location: "New York" })).toEqual({});
  });

  it("rejects blank fields and numbers", () => {
    expect(validateProfile({ name: "  ", location: "New York 2" })).toEqual({
      name: "Please enter your name.",
      location: "Your location cannot contain numbers.",
    });
  });

  it("validates a single step without requiring the next field", () => {
    expect(validateProfileField("name", "Jordan Lee")).toBeUndefined();
    expect(validateProfileField("location", "")).toBe("Please enter your location.");
  });
});
