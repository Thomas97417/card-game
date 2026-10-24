import { httpRouter } from "convex/server";

import { authComponent, createAuth } from "./auth";
import { internal } from "./_generated/api";
import { polar } from "./polar";

const http = httpRouter();

authComponent.registerRoutes(http, createAuth);

polar.registerRoutes(http, {
  events: {
    "order.paid": async (ctx, { data }) => {
      if (
        data.metadata.purpose !== "emerald_pack" ||
        !data.checkoutId ||
        !data.productId
      )
        return;
      await ctx.runMutation(internal.payments.processOrder, {
        kind: "paid",
        orderId: data.id,
        checkoutId: data.checkoutId,
        customerId: data.customerId,
        productId: data.productId,
        currency: data.currency,
        paid: data.paid,
        status: data.status,
        netAmount: data.netAmount,
        refundedAmount: data.refundedAmount,
      });
    },
    "order.refunded": async (ctx, { data }) => {
      if (
        data.metadata.purpose !== "emerald_pack" ||
        !data.checkoutId ||
        !data.productId
      )
        return;
      await ctx.runMutation(internal.payments.processOrder, {
        kind: "refunded",
        orderId: data.id,
        checkoutId: data.checkoutId,
        customerId: data.customerId,
        productId: data.productId,
        currency: data.currency,
        paid: data.paid,
        status: data.status,
        netAmount: data.netAmount,
        refundedAmount: data.refundedAmount,
      });
    },
  },
});

export default http;
