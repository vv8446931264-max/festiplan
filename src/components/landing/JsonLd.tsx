import { headers } from "next/headers";
import { serializeJsonLd } from "@/lib/seo/json-ld";
import { landingJsonLd } from "@/lib/seo/metadata";

/**
 * The landing page's structured data as an inline JSON-LD block. It carries this request's
 * CSP nonce (minted in `src/proxy.ts`, forwarded as `x-nonce`) like every other inline script,
 * and `serializeJsonLd` escapes `<` so the data can never close the element.
 */
export async function LandingJsonLd() {
  const nonce = (await headers()).get("x-nonce") ?? undefined;
  return (
    <script
      type="application/ld+json"
      nonce={nonce}
      dangerouslySetInnerHTML={{ __html: serializeJsonLd(landingJsonLd()) }}
    />
  );
}
