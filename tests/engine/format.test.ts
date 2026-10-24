// @vitest-environment node
import { describe, expect, it } from "vitest";
import {
  formatDate,
  formatDateShort,
  formatINR,
  formatINRCompact,
  formatPercent,
  mapsSearchUrl,
  planTitle,
} from "@/lib/engine/format";

describe("formatINR", () => {
  it("groups digits the Indian way", () => {
    expect(formatINR(1_200_000)).toBe("₹12,00,000");
    expect(formatINR(500_000_000)).toBe("₹50,00,00,000");
    expect(formatINR(999)).toBe("₹999");
    expect(formatINR(0)).toBe("₹0");
  });

  it("keeps the sign in front and rounds fractions", () => {
    expect(formatINR(-1_200_000)).toBe("-₹12,00,000");
    expect(formatINR(1234.6)).toBe("₹1,235");
  });

  it("never prints a negative zero", () => {
    expect(formatINR(-0.4)).toBe("₹0");
    expect(formatINR(-0)).toBe("₹0");
  });
});

describe("formatINRCompact", () => {
  it("uses crore, lakh and thousand suffixes", () => {
    expect(formatINRCompact(12_000_000)).toBe("₹1.2Cr");
    expect(formatINRCompact(10_000_000)).toBe("₹1Cr");
    expect(formatINRCompact(500_000_000)).toBe("₹50Cr");
    expect(formatINRCompact(1_200_000)).toBe("₹12L");
    expect(formatINRCompact(250_000)).toBe("₹2.5L");
    expect(formatINRCompact(100_000)).toBe("₹1L");
    expect(formatINRCompact(40_000)).toBe("₹40K");
    expect(formatINRCompact(1_500)).toBe("₹1.5K");
    expect(formatINRCompact(1_000)).toBe("₹1K");
  });

  it("falls back to the full format below one thousand", () => {
    expect(formatINRCompact(999)).toBe("₹999");
    expect(formatINRCompact(0)).toBe("₹0");
  });

  it("handles negatives", () => {
    expect(formatINRCompact(-1_200_000)).toBe("-₹12L");
    expect(formatINRCompact(-500)).toBe("-₹500");
  });
});

describe("formatDate / formatDateShort", () => {
  it("formats ISO dates in en-IN, UTC", () => {
    expect(formatDate("2027-02-14")).toBe("14 Feb 2027");
    expect(formatDate("2026-12-31")).toBe("31 Dec 2026");
    expect(formatDate("2026-01-01")).toBe("1 Jan 2026");
    expect(formatDateShort("2027-02-14")).toBe("14 Feb");
  });

  it("returns an unparsable input unchanged instead of throwing", () => {
    expect(formatDate("not-a-date")).toBe("not-a-date");
    expect(formatDateShort("")).toBe("");
  });
});

describe("formatPercent", () => {
  it("keeps at most one decimal and drops a trailing .0", () => {
    expect(formatPercent(12.5)).toBe("12.5%");
    expect(formatPercent(12)).toBe("12%");
    expect(formatPercent(12.04)).toBe("12%");
    expect(formatPercent(33.333)).toBe("33.3%");
    expect(formatPercent(0)).toBe("0%");
    expect(formatPercent(-0.01)).toBe("0%");
  });
});

describe("mapsSearchUrl", () => {
  it("encodes the query", () => {
    expect(mapsSearchUrl("wedding venues in Pune")).toBe(
      "https://www.google.com/maps/search/?api=1&query=wedding%20venues%20in%20Pune",
    );
    expect(mapsSearchUrl("a&b=c/ü")).toBe("https://www.google.com/maps/search/?api=1&query=a%26b%3Dc%2F%C3%BC");
  });
});

describe("formatINRCompact rounding carry", () => {
  it("promotes to the next unit when rounding reaches it", () => {
    expect(formatINRCompact(9_999_999)).toBe("₹1Cr");
    expect(formatINRCompact(99_960)).toBe("₹1L");
    expect(formatINRCompact(-9_999_999)).toBe("-₹1Cr");
    expect(formatINRCompact(9_940_000)).toBe("₹99.4L");
  });
});

describe("planTitle", () => {
  it("prefers the user's own name, trimmed", () => {
    expect(planTitle({ title: "  Riya's sangeet ", eventType: "wedding", city: "Jaipur" })).toBe("Riya's sangeet");
  });
  it("falls back to the event type and city", () => {
    expect(planTitle({ eventType: "community", city: "Pune" })).toBe("Community in Pune");
    expect(planTitle({ title: "   ", eventType: "birthday", city: "Bengaluru" })).toBe("Birthday in Bengaluru");
  });
});
