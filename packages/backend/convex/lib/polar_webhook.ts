import { Webhook, WebhookVerificationError } from "standardwebhooks";

/** Polar switched new secrets to Standard Webhooks on September 8, 2026. */
export function verifyPolarWebhook(
  body: string,
  headers: Record<string, string>,
  secret: string,
): unknown {
  if (!secret) throw new Error("POLAR_WEBHOOK_SECRET is not configured on Convex.");

  // Earlier endpoints sign with the UTF-8 bytes of the full secret, including whsec_.
  const verifiers = [
    new Webhook(new TextEncoder().encode(secret), { format: "raw" }),
  ];
  if (secret.startsWith("whsec_")) {
    try {
      // Standard Webhooks decodes the base64 key after the whsec_ prefix.
      verifiers.unshift(new Webhook(secret));
    } catch {
      // Legacy secrets may have a whsec_ prefix without a valid base64 key.
    }
  }

  for (const verifier of verifiers) {
    try {
      return verifier.verify(body, headers);
    } catch (error) {
      if (!(error instanceof WebhookVerificationError)) throw error;
    }
  }
  throw new WebhookVerificationError("No matching Polar webhook signature found.");
}
