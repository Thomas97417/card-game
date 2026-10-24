import { ConvexError, v } from "convex/values";
import {
  EMERALD_PACKS,
  type EmeraldPackId,
  type EmeraldPackOffer,
  type EmeraldPaymentStatus,
} from "@sylve/game/emerald-packs";
import { api, internal } from "./_generated/api";
import {
  action,
  internalAction,
  internalMutation,
  query,
} from "./_generated/server";
import { requirePlayer } from "./lib/game_service";
import { ensureEmeraldWallet } from "./lib/progression";
import { polar } from "./polar";

const packValidator = v.union(
  v.literal("pouch"),
  v.literal("coffer"),
  v.literal("chest"),
  v.literal("hoard"),
  v.literal("royal"),
);

function configuredProducts(): Record<EmeraldPackId, string | undefined> {
  return {
    pouch: process.env.POLAR_PRODUCT_EMERALDS_POUCH,
    coffer: process.env.POLAR_PRODUCT_EMERALDS_COFFER,
    chest: process.env.POLAR_PRODUCT_EMERALDS_CHEST,
    hoard: process.env.POLAR_PRODUCT_EMERALDS_HOARD,
    royal: process.env.POLAR_PRODUCT_EMERALDS_ROYAL,
  };
}

export const offers = query({
  args: {},
  handler: async (ctx): Promise<EmeraldPackOffer[]> => {
    await requirePlayer(ctx);
    const ids = configuredProducts();
    const products = await polar.listProducts(ctx);
    const configured = !!(
      process.env.POLAR_ORGANIZATION_TOKEN &&
      process.env.POLAR_WEBHOOK_SECRET &&
      process.env.SITE_URL
    );
    return EMERALD_PACKS.map((pack) => {
      const id = ids[pack.id];
      // A product must identify exactly one pack, with one fixed EUR one-time price.
      const product = products.find((item) => item.id === id);
      const prices = product?.prices.filter((price) => !price.isArchived) ?? [];
      const price = prices.length === 1 ? prices[0] : undefined;
      const valid =
        product &&
        !product.isRecurring &&
        !product.isArchived &&
        Object.values(ids).filter((value) => value === id).length === 1 &&
        price?.amountType === "fixed" &&
        price.priceCurrency === "eur" &&
        Number.isSafeInteger(price.priceAmount) &&
        price.priceAmount! > 0;
      return {
        id: pack.id,
        priceAmount: valid ? price!.priceAmount! : null,
        priceCurrency: valid ? price!.priceCurrency! : null,
        available: configured && !!valid,
      };
    });
  },
});

export const createCheckout = action({
  args: { packId: packValidator },
  handler: async (ctx, { packId }): Promise<{ url: string }> => {
    const user = await ctx.runQuery(api.auth.getCurrentUser, {});
    if (!user)
      throw new ConvexError("Connecte-toi pour acheter des émeraudes.");
    const availableOffers = await ctx.runQuery(api.payments.offers, {});
    const offer = availableOffers.find((item) => item.id === packId);
    const productId = configuredProducts()[packId];
    if (!offer?.available || !productId)
      throw new ConvexError(
        "Ce pack d’émeraudes est momentanément indisponible.",
      );
    const pack = EMERALD_PACKS.find((item) => item.id === packId)!;
    const site = new URL(process.env.SITE_URL!);
    // The caller cannot supply a recipient, a quantity, a product or a return URL.
    const checkout = await polar.createCheckoutSession(ctx, {
      productIds: [productId],
      userId: String(user._id),
      email: user.email,
      origin: site.origin,
      successUrl: `${site.origin}/sanctuary?checkout={CHECKOUT_ID}`,
      metadata: { purpose: "emerald_pack", packId, userId: String(user._id) },
    });
    if (!checkout.customerId)
      throw new Error("Polar checkout has no customer.");
    if (
      checkout.amount !== offer.priceAmount ||
      checkout.currency !== offer.priceCurrency
    )
      throw new ConvexError(
        "Le prix de ce pack vient de changer. Actualise la page avant de réessayer.",
      );
    await ctx.runMutation(internal.payments.recordCheckout, {
      ownerId: String(user._id),
      checkoutId: checkout.id,
      customerId: checkout.customerId,
      productId,
      packId,
      emeralds: pack.emeralds,
      priceAmount: offer.priceAmount!,
      priceCurrency: offer.priceCurrency!,
    });
    const checkoutUrl = new URL(checkout.url);
    checkoutUrl.searchParams.set("locale", "fr");
    return { url: checkoutUrl.toString() };
  },
});

export const recordCheckout = internalMutation({
  args: {
    ownerId: v.string(),
    checkoutId: v.string(),
    customerId: v.string(),
    productId: v.string(),
    packId: packValidator,
    emeralds: v.number(),
    priceAmount: v.number(),
    priceCurrency: v.string(),
  },
  handler: async (ctx, args) => {
    const previous = await ctx.db
      .query("emeraldPurchases")
      .withIndex("by_checkout", (q) => q.eq("checkoutId", args.checkoutId))
      .unique();
    if (previous) return;
    await ctx.db.insert("emeraldPurchases", {
      ...args,
      status: "pending",
      creditedEmeralds: 0,
      refundedEmeralds: 0,
    });
  },
});

/** Only called by the component after verifying the Polar webhook signature. */
export const processOrder = internalMutation({
  args: {
    kind: v.union(v.literal("paid"), v.literal("refunded")),
    orderId: v.string(),
    checkoutId: v.string(),
    customerId: v.string(),
    productId: v.string(),
    currency: v.string(),
    paid: v.boolean(),
    status: v.string(),
    netAmount: v.number(),
    refundedAmount: v.number(),
  },
  handler: async (ctx, order) => {
    if (order.kind === "paid" && (!order.paid || order.status !== "paid"))
      return;
    const purchase = await ctx.db
      .query("emeraldPurchases")
      .withIndex("by_checkout", (q) => q.eq("checkoutId", order.checkoutId))
      .unique();
    // A missing record is retryable: never acknowledge an unfulfilled in-app payment.
    if (!purchase)
      throw new Error("Emerald checkout not found; retry this webhook.");
    if (
      purchase.productId !== order.productId ||
      purchase.customerId !== order.customerId ||
      purchase.priceCurrency !== order.currency ||
      (purchase.orderId && purchase.orderId !== order.orderId)
    )
      throw new Error("Polar order does not match the emerald checkout.");
    const existingOrder = await ctx.db
      .query("emeraldPurchases")
      .withIndex("by_order", (q) => q.eq("orderId", order.orderId))
      .unique();
    if (existingOrder && existingOrder._id !== purchase._id)
      throw new Error("Polar order already belongs to another checkout.");
    if (
      !Number.isSafeInteger(order.netAmount) ||
      order.netAmount < 0 ||
      !Number.isSafeInteger(order.refundedAmount) ||
      order.refundedAmount < 0
    )
      throw new Error("Invalid Polar order amount.");
    const refunded =
      order.status === "refunded"
        ? purchase.emeralds
        : order.netAmount > 0
          ? Math.floor(
              purchase.emeralds *
                Math.min(order.refundedAmount / order.netAmount, 1),
            )
          : 0;
    // Refunds are cumulative. Replayed or older paid events cannot restore them.
    const refundedEmeralds = Math.max(purchase.refundedEmeralds, refunded);
    const creditedEmeralds = purchase.emeralds - refundedEmeralds;
    const delta = creditedEmeralds - purchase.creditedEmeralds;
    if (delta !== 0) {
      const wallet = await ensureEmeraldWallet(ctx, purchase.ownerId);
      await ctx.db.patch(wallet._id, { diamonds: wallet.diamonds! + delta });
    }
    await ctx.db.patch(purchase._id, {
      orderId: order.orderId,
      status: refundedEmeralds === purchase.emeralds ? "refunded" : "paid",
      creditedEmeralds,
      refundedEmeralds,
    });
  },
});

export const checkoutStatus = query({
  args: { checkoutId: v.string() },
  handler: async (
    ctx,
    { checkoutId },
  ): Promise<EmeraldPaymentStatus | null> => {
    const { userId } = await requirePlayer(ctx);
    const purchase = await ctx.db
      .query("emeraldPurchases")
      .withIndex("by_checkout", (q) => q.eq("checkoutId", checkoutId))
      .unique();
    if (!purchase || purchase.ownerId !== userId) return null;
    return { status: purchase.status, emeralds: purchase.creditedEmeralds };
  },
});

/** Run once from the Convex dashboard/CLI for products that already exist in Polar. */
export const syncProducts = internalAction({
  args: {},
  handler: async (ctx) => {
    if (!process.env.POLAR_ORGANIZATION_TOKEN)
      throw new Error("Configure POLAR_ORGANIZATION_TOKEN first.");
    await polar.syncProducts(ctx);
  },
});
