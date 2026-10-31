// @vitest-environment node
import { describe, expect, it } from "vitest";
import type { ScheduledTask } from "@/lib/contracts";
import { buildIcs, escapeIcsText, foldLine } from "@/lib/engine/ics";

const UTF8 = new TextEncoder();
const octets = (s: string): number => UTF8.encode(s).length;
const unfold = (s: string): string => s.replace(/\r\n /g, "");

/** Tiny seeded PRNG so failures are reproducible. */
function mulberry32(seed: number): () => number {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

describe("escapeIcsText", () => {
  it("escapes backslash, semicolon, comma and line breaks", () => {
    expect(escapeIcsText("a\\b;c,d")).toBe("a\\\\b\\;c\\,d");
    expect(escapeIcsText("one\ntwo\r\nthree\rfour")).toBe("one\\ntwo\\nthree\\nfour");
    expect(escapeIcsText("plain text")).toBe("plain text");
    expect(escapeIcsText("")).toBe("");
  });

  it("escapes backslashes before the other characters", () => {
    expect(escapeIcsText("\\;")).toBe("\\\\\\;");
  });
});

describe("foldLine", () => {
  it("leaves lines of up to 75 octets alone", () => {
    expect(foldLine("")).toBe("");
    expect(foldLine("a".repeat(75))).toBe("a".repeat(75));
  });

  it("folds at 75 octets, then 74 content octets per continuation line", () => {
    const folded = foldLine("a".repeat(76));
    expect(folded).toBe(`${"a".repeat(75)}\r\n a`);
    const lines = foldLine("b".repeat(75 + 74 * 2 + 1)).split("\r\n");
    expect(lines.map((l) => l.length)).toEqual([75, 75, 75, 2]);
    expect(lines.slice(1).every((l) => l.startsWith(" "))).toBe(true);
  });

  it("never splits a multi-byte character", () => {
    const rupees = "₹".repeat(40); // 3 octets each
    const lines = foldLine(rupees).split("\r\n");
    expect(lines[0]).toBe("₹".repeat(25));
    expect(lines.every((l) => octets(l) <= 75)).toBe(true);
    expect(unfold(foldLine(rupees))).toBe(rupees);
    const text = `${"a".repeat(74)}₹`; // the 3-octet char must move to the next line
    expect(foldLine(text)).toBe(`${"a".repeat(74)}\r\n ₹`);
  });

  it("handles 2-, 3- and 4-octet characters and Devanagari", () => {
    for (const sample of ["é", "₹", "😀", "नमस्ते", "मुंबई में शादी"]) {
      const line = `SUMMARY:${sample.repeat(60)}`;
      const folded = foldLine(line);
      expect(folded.split("\r\n").every((l) => octets(l) <= 75)).toBe(true);
      expect(unfold(folded)).toBe(line);
    }
  });

  it("round-trips random mixed-script lines within 75 octets (property)", () => {
    const alphabet = ["a", "Z", " ", ":", "é", "₹", "ह", "ं", "😀", "𝄞"];
    const rand = mulberry32(21);
    for (let n = 0; n < 500; n++) {
      const line = Array.from(
        { length: Math.floor(rand() * 200) },
        () => alphabet[Math.floor(rand() * alphabet.length)],
      ).join("");
      const parts = foldLine(line).split("\r\n");
      expect(parts.every((p) => octets(p) <= 75)).toBe(true);
      expect(parts.every((p) => new TextDecoder().decode(UTF8.encode(p)) === p)).toBe(true);
      expect(unfold(parts.join("\r\n"))).toBe(line);
    }
  });
});

describe("buildIcs", () => {
  const task = (id: string, title: string, start: string, due: string): ScheduledTask => ({
    id,
    title,
    category: "venue",
    start,
    due,
    phase: "1-3m",
    done: false,
    overdue: false,
    crunch: false,
  });
  const tasks = [
    task("book-venue", "Book venue, confirm; pay", "2026-11-01", "2026-11-15"),
    task("send-cards", "Send cards", "2026-12-20", "2026-12-31"),
  ];
  const input = {
    planId: "plan123",
    title: "Riya & Arjun's sangeet",
    eventDate: "2027-02-14",
    city: "Pune",
    tasks,
    url: "https://festiplan.example/plan/plan123",
    dtstamp: "20261024T000000Z",
  };
  const ics = buildIcs(input);
  const lines = ics.split("\r\n");

  it("is a CRLF-terminated VCALENDAR with the header fields", () => {
    expect(
      ics.startsWith(
        "BEGIN:VCALENDAR\r\nVERSION:2.0\r\nPRODID:-//FestiPlan//Planner//EN\r\nCALSCALE:GREGORIAN\r\nMETHOD:PUBLISH\r\n",
      ),
    ).toBe(true);
    expect(ics.endsWith("END:VCALENDAR\r\n")).toBe(true);
    expect(ics).not.toMatch(/(?<!\r)\n/);
    expect(lines).toContain("X-WR-CALNAME:Riya & Arjun's sangeet");
  });

  it("has an all-day event for the celebration", () => {
    expect(lines).toContain("UID:plan123@festiplan");
    expect(lines).toContain("DTSTAMP:20261024T000000Z");
    expect(lines).toContain("DTSTART;VALUE=DATE:20270214");
    expect(lines).toContain("DTEND;VALUE=DATE:20270215");
    expect(lines).toContain("SUMMARY:Riya & Arjun's sangeet");
    expect(lines).toContain("LOCATION:Pune");
    expect(lines).toContain("URL:https://festiplan.example/plan/plan123");
  });

  it("has one all-day event per task on its due date, with start date and url", () => {
    expect(lines.filter((l) => l === "BEGIN:VEVENT")).toHaveLength(3);
    expect(lines.filter((l) => l === "END:VEVENT")).toHaveLength(3);
    expect(lines).toContain("UID:plan123-book-venue@festiplan");
    expect(lines).toContain("DTSTART;VALUE=DATE:20261115");
    expect(lines).toContain("DTEND;VALUE=DATE:20261116");
    expect(lines).toContain("SUMMARY:Book venue\\, confirm\\; pay");
    expect(lines).toContain(
      "DESCRIPTION:Start: 1 Nov 2026\\nhttps://festiplan.example/plan/plan123",
    );
  });

  it("rolls DTEND over a year end", () => {
    expect(lines).toContain("DTSTART;VALUE=DATE:20261231");
    expect(lines).toContain("DTEND;VALUE=DATE:20270101");
  });

  it("produces only the celebration event when there are no tasks", () => {
    const only = buildIcs({ ...input, tasks: [] });
    expect(only.split("\r\n").filter((l) => l === "BEGIN:VEVENT")).toHaveLength(1);
  });

  it("folds long and multi-byte lines to 75 octets and unfolds back", () => {
    const long = buildIcs({
      ...input,
      title: `मुंबई की शादी ₹${"x".repeat(120)}`,
      city: "मुंबई, महाराष्ट्र",
      tasks: [task("t", `${"लंबा काम ".repeat(20)}end`, "2026-11-01", "2026-11-02")],
    });
    const physical = long.split("\r\n");
    expect(physical.every((l) => octets(l) <= 75)).toBe(true);
    const logical = unfold(long).split("\r\n");
    expect(logical).toContain("LOCATION:मुंबई\\, महाराष्ट्र");
    expect(logical).toContain(`X-WR-CALNAME:मुंबई की शादी ₹${"x".repeat(120)}`);
    expect(logical.some((l) => l.startsWith("SUMMARY:लंबा काम") && l.endsWith("end"))).toBe(true);
  });

  it("cannot be tricked into extra lines by line breaks in text fields", () => {
    const evil = buildIcs({
      ...input,
      title: "Hi\r\nEND:VCALENDAR",
      url: "https://x.example/\r\nBEGIN:VEVENT",
      planId: "p\r\nX-EVIL:1",
      dtstamp: "2026\nX-EVIL:2",
    });
    const out = evil.split("\r\n");
    expect(out.filter((l) => l === "END:VCALENDAR")).toHaveLength(1);
    expect(out.filter((l) => l === "BEGIN:VEVENT")).toHaveLength(3);
    expect(out.some((l) => l.startsWith("X-EVIL"))).toBe(false);
    expect(out).toContain("URL:https://x.example/BEGIN:VEVENT");
  });
});
