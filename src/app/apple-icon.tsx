import { brandIconResponse } from "@/lib/seo/icon-art";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

/** The 180 × 180 home-screen icon iOS asks for; opaque and full-bleed, iOS rounds the corners. */
export default function AppleIcon() {
  return brandIconResponse(size.width);
}
