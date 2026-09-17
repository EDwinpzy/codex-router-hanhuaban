import { isUtf8 } from "node:buffer";

// DeepSeek's hosted Flash API resizes every image to at most 1024 tokens.
// The older Flash names now alias that model. This bound is not established
// for every route that relays the same model, so it is granted per provider and
// per model family, and only where it was actually measured:
//
//   deepseek     -- the vendor's own documentation (below).
//   opencode-go  -- measured 2026-09-17: a 2,048,877-byte PNG (2.7 MB of
//                   base64) beside a 36-token prompt answered with
//                   prompt_tokens=1025, so the image cost 989 tokens rather
//                   than the ~828,000 the raw byte ratio charges it.
//
// Command Code, OpenRouter, Nous Portal and Ollama Cloud relay the same model
// and very likely the same vision pipeline, but none of them has been measured
// here, so they keep the conservative whole-byte count. Widening this is a
// measurement, not an inference from the vendor's documentation.
//
// Verified 2026-09-10: https://api-docs.deepseek.com/guides/vision/#token-usage
const DEEPSEEK_IMAGE_TOKEN_BOUND = 1024;
const MEASURED_IMAGE_TOKEN_BOUNDS = new Map([
  [
    "deepseek",
    new Set(["deepseek-flash", "deepseek-v4-flash", "deepseek-v4-flash-vision-exp"]),
  ],
  ["opencode-go", new Set(["deepseek-v4.1-flash"])],
]);

export function maxImageTokensForRoute(route) {
  const families = MEASURED_IMAGE_TOKEN_BOUNDS.get(route?.provider);
  if (!families) return undefined;
  // A reseller spells the vendor into the id (`deepseek/deepseek-v4.1-flash`),
  // so the model a route serves is the last path segment either way.
  const family = String(route?.upstreamModel || "").split("/").pop();
  return families.has(family) ? DEEPSEEK_IMAGE_TOKEN_BOUND : undefined;
}

// Discount only image references in actual Responses content arrays. A pasted
// JSON example, tool schema, unknown field, or text-only request keeps the old
// byte estimate. This never changes the body forwarded to the provider.
export function promptImageUsage(buffer, maxTokensPerImage) {
  const unchanged = { bytes: 0, tokens: 0 };
  if (
    !Number.isSafeInteger(maxTokensPerImage) || maxTokensPerImage <= 0 ||
    !buffer.includes('"input_image"') || !isUtf8(buffer)
  ) return unchanged;

  const referenceBytes = new WeakMap();
  let payload;
  try {
    payload = JSON.parse(buffer.toString("utf8"), function (key, value, context) {
      if ((key === "image_url" || key === "file_id") && typeof value === "string") {
        // The source slice preserves JSON escapes and surrounding whitespace in
        // the byte estimate. Keep the string's quotes as structural overhead.
        const bytes = typeof context?.source === "string"
          ? Buffer.byteLength(context.source, "utf8") - 2 : 0;
        const fields = referenceBytes.get(this) || {};
        fields[key] = bytes;
        referenceBytes.set(this, fields);
      }
      return value;
    });
  } catch {
    return unchanged;
  }

  let bytes = 0;
  let tokens = 0;
  for (const item of Array.isArray(payload?.input) ? payload.input : []) {
    const isMessage = (item?.type === "message" || item?.type === undefined) &&
      (item?.role === "user" || item?.role === "developer");
    const isToolOutput = item?.type === "function_call_output" ||
      item?.type === "custom_tool_call_output";
    const parts = isMessage ? item.content : isToolOutput ? item.output : undefined;
    for (const part of Array.isArray(parts) ? parts : []) {
      if (part?.type !== "input_image") continue;
      const hasUrl = typeof part.image_url === "string" && part.image_url.length > 0;
      const hasFile = typeof part.file_id === "string" && part.file_id.length > 0;
      // Ambiguous or malformed references stay conservatively counted whole.
      if (hasUrl === hasFile) continue;
      const key = hasUrl ? "image_url" : "file_id";
      if (hasUrl && !/^(?:data:image\/|https?:\/\/)/i.test(part.image_url)) continue;
      bytes += referenceBytes.get(part)?.[key] || 0;
      tokens += maxTokensPerImage;
    }
  }
  return { bytes, tokens };
}
