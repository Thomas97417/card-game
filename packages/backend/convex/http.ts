import { httpRouter } from "convex/server";
import { WebhookVerificationError } from "standardwebhooks";
import { z } from "zod";

import { authComponent, createAuth } from "./auth";
import { internal } from "./_generated/api";
import { httpAction } from "./_generated/server";
import { verifyPolarWebhook } from "./lib/polar_webhook";
import { polar } from "./polar";

const http = httpRouter();

authComponent.registerRoutes(http, createAuth);

const eventSchema = z.object({
  type: z.string(),
  data: z.record(z.string(), z.unknown()),
});
const purchaseMetadataSchema = z.object({
  metadata: z.object({ purpose: z.enum(["emerald_pack", "legendary_offer"]) }),
});
// Validate only the fields our payment ledger uses, independently of SDK versions.
const orderSchema = z.object({
  id: z.string().min(1),
  checkout_id: z.string().min(1),
  customer_id: z.string().min(1),
  product_id: z.string().min(1),
  currency: z.string().min(1),
  paid: z.boolean(),
  status: z.string().min(1),
  net_amount: z.number().int().nonnegative(),
  refunded_amount: z.number().int().nonnegative(),
});

// The component's 0.47.x SDK only verifies legacy signatures. Keep the component
// for checkouts/products, and verify both signing schemes on the raw HTTP body.
http.route({
  path: "/polar/events",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    const body = await request.text();
    let payload: unknown;
    try {
      payload = verifyPolarWebhook(
        body,
        {
          "webhook-id": request.headers.get("webhook-id") ?? "",
          "webhook-timestamp": request.headers.get("webhook-timestamp") ?? "",
          "webhook-signature": request.headers.get("webhook-signature") ?? "",
        },
        process.env.POLAR_WEBHOOK_SECRET ?? "",
      );
    } catch (error) {
      if (error instanceof WebhookVerificationError) {
        console.error(
          "Polar signature rejected. Check POLAR_WEBHOOK_SECRET on this Convex deployment.",
        );
        return new Response("Forbidden", { status: 403 });
      }
      if (error instanceof SyntaxError)
        return new Response("Invalid JSON", { status: 400 });
      throw error;
    }

    const parsed = eventSchema.safeParse(payload);
    if (!parsed.success) return new Response("Invalid event", { status: 400 });
    const { type, data } = parsed.data;
    if (type === "product.created" || type === "product.updated") {
      // Fetch authoritative products through the component rather than parsing
      // the current webhook with the older SDK's full product schema.
      if (typeof data.id !== "string" || !data.id)
        return new Response("Invalid product", { status: 400 });
      await polar.syncProducts(ctx);
    } else if (
      (type === "order.paid" || type === "order.refunded") &&
      purchaseMetadataSchema.safeParse(data).success
    ) {
      const order = orderSchema.safeParse(data);
      if (!order.success) return new Response("Invalid order", { status: 400 });
      const args = {
        kind: type === "order.paid" ? ("paid" as const) : ("refunded" as const),
        orderId: order.data.id,
        checkoutId: order.data.checkout_id,
        customerId: order.data.customer_id,
        productId: order.data.product_id,
        currency: order.data.currency,
        paid: order.data.paid,
        status: order.data.status,
        netAmount: order.data.net_amount,
        refundedAmount: order.data.refunded_amount,
      };
      if (
        purchaseMetadataSchema.parse(data).metadata.purpose ===
        "legendary_offer"
      ) {
        const total = z
          .number()
          .int()
          .nonnegative()
          .safeParse(data.total_amount);
        if (!total.success)
          return new Response("Invalid order total", { status: 400 });
        await ctx.runMutation(internal.payments.processLegendaryOrder, {
          ...args,
          totalAmount: total.data,
        });
      } else await ctx.runMutation(internal.payments.processOrder, args);
    }
    return new Response("Accepted", { status: 202 });
  }),
});

export default http;
