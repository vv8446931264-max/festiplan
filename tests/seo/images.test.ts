// @vitest-environment node
import { describe, expect, it } from "vitest";
import AppleIcon, * as apple from "@/app/apple-icon";
import Icon, { generateImageMetadata } from "@/app/icon";
import OpengraphImage, * as og from "@/app/opengraph-image";
import * as twitter from "@/app/twitter-image";
import { BRAND_ICON_SVG } from "@/lib/seo/icon-art";

/** Width and height from a PNG's IHDR chunk, after checking the signature. */
async function pngSize(res: Response): Promise<{ width: number; height: number }> {
  const bytes = new Uint8Array(await res.arrayBuffer());
  expect([...bytes.slice(0, 8)]).toEqual([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const view = new DataView(bytes.buffer, bytes.byteOffset);
  return { width: view.getUint32(16), height: view.getUint32(20) };
}

describe("Open Graph and Twitter card", () => {
  it("declares 1200 × 630 PNG with alt text, shared by twitter-image", () => {
    expect(og.size).toEqual({ width: 1200, height: 630 });
    expect(og.contentType).toBe("image/png");
    expect(og.alt.length).toBeGreaterThan(20);
    expect(twitter.default).toBe(OpengraphImage);
    expect(twitter.size).toBe(og.size);
    expect(twitter.alt).toBe(og.alt);
  });

  it("renders a 1200 × 630 PNG", async () => {
    expect(await pngSize(OpengraphImage())).toEqual({ width: 1200, height: 630 });
  });
});

describe("app icons", () => {
  it("generates 192 and 512 px PNG icons", async () => {
    const meta = generateImageMetadata();
    expect(meta.map((m) => m.id)).toEqual(["192", "512"]);
    for (const m of meta) {
      expect(await pngSize(await Icon({ id: Promise.resolve(m.id) }))).toEqual(m.size);
    }
  });

  it("renders a 180 × 180 apple-touch-icon", async () => {
    expect(apple.size).toEqual({ width: 180, height: 180 });
    expect(await pngSize(AppleIcon())).toEqual(apple.size);
  });

  it("draws the lantern on an opaque full-bleed square (needed for iOS and maskable)", () => {
    expect(BRAND_ICON_SVG).toMatch(/<rect width="64" height="64" fill="#100904"\/>/);
    expect(BRAND_ICON_SVG).not.toContain('rx="14"');
  });
});
