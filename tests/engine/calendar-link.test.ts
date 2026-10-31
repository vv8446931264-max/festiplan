// @vitest-environment node
import { describe, expect, it } from "vitest";
import { googleCalendarUrl } from "@/lib/engine/calendar-link";

const parse = (url: string): URL => new URL(url);

describe("googleCalendarUrl", () => {
  it("builds an all-day TEMPLATE link ending the day after", () => {
    const url = parse(googleCalendarUrl({ title: "Book venue", date: "2027-02-14" }));
    expect(url.origin + url.pathname).toBe("https://calendar.google.com/calendar/render");
    expect(url.searchParams.get("action")).toBe("TEMPLATE");
    expect(url.searchParams.get("text")).toBe("Book venue");
    expect(url.searchParams.get("dates")).toBe("20270214/20270215");
  });

  it("rolls the exclusive end over month and year boundaries", () => {
    const url = parse(googleCalendarUrl({ title: "NYE", date: "2026-12-31" }));
    expect(url.searchParams.get("dates")).toBe("20261231/20270101");
  });

  it("uses an explicit end date as given", () => {
    const url = parse(
      googleCalendarUrl({ title: "Sangeet", date: "2027-02-14", endDate: "2027-02-17" }),
    );
    expect(url.searchParams.get("dates")).toBe("20270214/20270217");
  });

  it("omits details and location when absent", () => {
    const raw = googleCalendarUrl({ title: "x", date: "2027-02-14" });
    expect(raw).not.toContain("details=");
    expect(raw).not.toContain("location=");
    expect([...parse(raw).searchParams.keys()]).toEqual(["action", "text", "dates"]);
  });

  it("includes encoded details and location when present", () => {
    const url = parse(
      googleCalendarUrl({
        title: "Riya & Arjun's sangeet",
        date: "2027-02-14",
        details: "Plan: https://festiplan.example/plan/abc?x=1&y=2",
        location: "मुंबई, India",
      }),
    );
    expect(url.searchParams.get("text")).toBe("Riya & Arjun's sangeet");
    expect(url.searchParams.get("details")).toBe(
      "Plan: https://festiplan.example/plan/abc?x=1&y=2",
    );
    expect(url.searchParams.get("location")).toBe("मुंबई, India");
    expect([...url.searchParams.keys()]).toEqual([
      "action",
      "text",
      "dates",
      "details",
      "location",
    ]);
  });

  it("keeps empty-string details and location (they were provided)", () => {
    const url = parse(
      googleCalendarUrl({ title: "x", date: "2027-02-14", details: "", location: "" }),
    );
    expect(url.searchParams.get("details")).toBe("");
    expect(url.searchParams.get("location")).toBe("");
  });
});
