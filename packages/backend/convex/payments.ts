import { ConvexError, v } from "convex/values";
import { checkoutsUpdate } from "@polar-sh/sdk/funcs/checkoutsUpdate.js";
import { productsGet } from "@polar-sh/sdk/funcs/productsGet.js";
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
import { catalogueMigration, rankProgress } from "@sylve/game";
import {
  LEGENDARY_OFFERS,
  LEGENDARY_OFFER_MAX_RANK,
  LEGENDARY_OFFER_PRICE,
  LEGENDARY_OFFER_EMERALDS,
  LEGENDARY_OFFER_GOLD,
  type LegendaryOfferId,
  type LegendaryOfferBoard,
  type LegendaryPaymentStatus,
} from "@sylve/game/legendary-offers";
import { grantLoot, ownedCard, playerWallet } from "./lib/progression";
import { migratePlayerCatalogue } from "./lib/catalogue";

const packValidator = v.union(
  v.literal("small-pouch"),
  v.literal("leather-satchel"),
  v.literal("wooden-case"),
  v.literal("carved-coffer"),
  v.literal("ancient-chest"),
);

function configuredProducts(): Record<EmeraldPackId, string | undefined> {
  return {
    // Preserve the existing product-to-quantity mapping during the catalog rename.
    "small-pouch":
      process.env.POLAR_PRODUCT_EMERALDS_SMALL_POUCH ??
      process.env.POLAR_PRODUCT_EMERALDS_POUCH,
    "leather-satchel":
      process.env.POLAR_PRODUCT_EMERALDS_LEATHER_SATCHEL ??
      process.env.POLAR_PRODUCT_EMERALDS_COFFER,
    "wooden-case":
      process.env.POLAR_PRODUCT_EMERALDS_WOODEN_CASE ??
      process.env.POLAR_PRODUCT_EMERALDS_CHEST,
    "carved-coffer":
      process.env.POLAR_PRODUCT_EMERALDS_CARVED_COFFER ??
      process.env.POLAR_PRODUCT_EMERALDS_HOARD,
    "ancient-chest":
      process.env.POLAR_PRODUCT_EMERALDS_ANCIENT_CHEST ??
      process.env.POLAR_PRODUCT_EMERALDS_ROYAL,
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
    checkoutUrl.searchParams.set("theme", "dark");
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

/** Only called by our HTTP handler after verifying the Polar webhook signature. */
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

const legendaryOfferValidator = v.union(
  v.literal("solar-oath"),
  v.literal("abyssal-pact"),
);

function configuredLegendaryProducts(): Record<
  LegendaryOfferId,
  string | undefined
> {
  return {
    "solar-oath": process.env.POLAR_PRODUCT_OFFER_SOLAR_PACT,
    "abyssal-pact": process.env.POLAR_PRODUCT_OFFER_ABYSSAL_PACT,
  };
}

export const legendaryOffers = query({
  args: {},
  handler: async (ctx): Promise<LegendaryOfferBoard> => {
    const { userId } = await requirePlayer(ctx);
    // This also projects legacy experience, exactly like the rank in the HUD.
    const wallet = await playerWallet(ctx, userId);
    const collection =
      wallet?.experience === undefined
        ? await ctx.db
            .query("collection")
            .withIndex("by_owner_variant", (q) => q.eq("ownerId", userId))
            .collect()
        : [];
    const { rank } = rankProgress(
      wallet?.experience ?? catalogueMigration(collection).experience,
    );
    const ids = configuredLegendaryProducts();
    const products = await polar.listProducts(ctx);
    const configured = !!(
      process.env.POLAR_ORGANIZATION_TOKEN &&
      process.env.POLAR_WEBHOOK_SECRET &&
      process.env.SITE_URL
    );
    const eligible = rank <= LEGENDARY_OFFER_MAX_RANK;
    const allIds = [
      ...Object.values(ids),
      ...Object.values(configuredProducts()),
    ];
    return {
      rank,
      eligible,
      offers: LEGENDARY_OFFERS.map(({ id }) => {
        const productId = ids[id];
        const product = products.find((item) => item.id === productId);
        const prices =
          product?.prices.filter((price) => !price.isArchived) ?? [];
        const price = prices.length === 1 ? prices[0] : undefined;
        return {
          id,
          available:
            configured &&
            eligible &&
            !!product &&
            !product.isRecurring &&
            !product.isArchived &&
            allIds.filter((item) => item === productId).length === 1 &&
            price?.amountType === "fixed" &&
            price.priceCurrency === "eur" &&
            price.priceAmount === LEGENDARY_OFFER_PRICE,
        };
      }),
    };
  },
});

export const createLegendaryCheckout = action({
  args: { offerId: legendaryOfferValidator },
  handler: async (ctx, { offerId }): Promise<{ url: string }> => {
    const user = await ctx.runQuery(api.auth.getCurrentUser, {});
    if (!user) throw new ConvexError("Connecte-toi pour acheter cette offre.");
    const board = await ctx.runQuery(api.payments.legendaryOffers, {});
    if (!board.eligible)
      throw new ConvexError(
        "Ces offres sont réservées aux rangs 1 à 25 inclus.",
      );
    const productId = configuredLegendaryProducts()[offerId];
    if (
      !productId ||
      !board.offers.find((offer) => offer.id === offerId)?.available
    )
      throw new ConvexError("Cette offre est momentanément indisponible.");
    // The component's product cache omits tax behavior. Read the live price to
    // guarantee a 20 € total before any player can enter payment information.
    const liveProduct = await productsGet(polar.polar, { id: productId });
    if (!liveProduct.ok) throw liveProduct.error;
    const prices = liveProduct.value.prices.filter(
      (price) => !price.isArchived,
    );
    const price = prices.length === 1 ? prices[0] : undefined;
    if (
      liveProduct.value.isArchived ||
      liveProduct.value.isRecurring ||
      price?.amountType !== "fixed" ||
      price.priceAmount !== LEGENDARY_OFFER_PRICE ||
      price.priceCurrency !== "eur" ||
      price.taxBehavior !== "inclusive"
    )
      throw new ConvexError("Cette offre est momentanément indisponible.");
    const site = new URL(process.env.SITE_URL!);
    const checkout = await polar.createCheckoutSession(ctx, {
      productIds: [productId],
      userId: String(user._id),
      email: user.email,
      origin: site.origin,
      successUrl: `${site.origin}/hub?offerCheckout={CHECKOUT_ID}`,
      metadata: {
        purpose: "legendary_offer",
        offerId,
        userId: String(user._id),
      },
    });
    if (!checkout.customerId)
      throw new Error("Polar checkout has no customer.");
    if (
      checkout.amount !== LEGENDARY_OFFER_PRICE ||
      checkout.currency !== "eur"
    )
      throw new ConvexError(
        "Le prix de cette offre a changé. Réessaie après actualisation.",
      );
    if (checkout.taxBehavior === "exclusive")
      throw new ConvexError("Cette offre est momentanément indisponible.");
    // The component enables coupon codes by default. Lock this fixed-price offer
    // before exposing its URL and give the checkout a way back to the refuge.
    const updated = await checkoutsUpdate(polar.polar, {
      id: checkout.id,
      checkoutUpdate: {
        allowDiscountCodes: false,
        discountId: null,
        returnUrl: `${site.origin}/hub`,
      },
    });
    if (!updated.ok) throw updated.error;
    if (
      updated.value.amount !== LEGENDARY_OFFER_PRICE ||
      updated.value.currency !== "eur" ||
      updated.value.allowDiscountCodes ||
      updated.value.taxBehavior === "exclusive"
    )
      throw new ConvexError("Cette offre est momentanément indisponible.");
    await ctx.runMutation(internal.payments.recordLegendaryCheckout, {
      ownerId: String(user._id),
      checkoutId: checkout.id,
      customerId: checkout.customerId,
      productId,
      offerId,
    });
    const url = new URL(checkout.url);
    url.searchParams.set("locale", "fr");
    url.searchParams.set("theme", "dark");
    return { url: url.toString() };
  },
});

export const recordLegendaryCheckout = internalMutation({
  args: {
    ownerId: v.string(),
    checkoutId: v.string(),
    customerId: v.string(),
    productId: v.string(),
    offerId: legendaryOfferValidator,
  },
  handler: async (ctx, args) => {
    const previous = await ctx.db
      .query("legendaryPurchases")
      .withIndex("by_checkout", (q) => q.eq("checkoutId", args.checkoutId))
      .unique();
    if (previous) return;
    // Recheck after Polar responds, before handing the URL to the player.
    await migratePlayerCatalogue(ctx, args.ownerId, true);
    const wallet = await ctx.db
      .query("wallets")
      .withIndex("by_owner", (q) => q.eq("ownerId", args.ownerId))
      .unique();
    if (rankProgress(wallet?.experience ?? 0).rank > LEGENDARY_OFFER_MAX_RANK)
      throw new ConvexError(
        "Ces offres sont réservées aux rangs 1 à 25 inclus.",
      );
    const offer = LEGENDARY_OFFERS.find((item) => item.id === args.offerId)!;
    await ctx.db.insert("legendaryPurchases", {
      ...args,
      emeralds: LEGENDARY_OFFER_EMERALDS,
      gold: LEGENDARY_OFFER_GOLD,
      cards: offer.cards.map((card) => ({ ...card })),
      priceAmount: LEGENDARY_OFFER_PRICE,
      priceCurrency: "eur",
      status: "pending",
      fulfilled: false,
      refundedFraction: 0,
    });
  },
});

/** Verified webhooks reconcile the complete bundle and its ledger atomically. */
export const processLegendaryOrder = internalMutation({
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
    totalAmount: v.number(),
  },
  handler: async (ctx, order) => {
    if (order.kind === "paid" && (!order.paid || order.status !== "paid"))
      return;
    const purchase = await ctx.db
      .query("legendaryPurchases")
      .withIndex("by_checkout", (q) => q.eq("checkoutId", order.checkoutId))
      .unique();
    if (!purchase)
      throw new Error("Legendary checkout not found; retry this webhook.");
    if (
      purchase.productId !== order.productId ||
      purchase.customerId !== order.customerId ||
      purchase.priceCurrency !== order.currency ||
      (purchase.orderId && purchase.orderId !== order.orderId)
    )
      throw new Error("Polar order does not match the legendary checkout.");
    const existingOrder = await ctx.db
      .query("legendaryPurchases")
      .withIndex("by_order", (q) => q.eq("orderId", order.orderId))
      .unique();
    if (existingOrder && existingOrder._id !== purchase._id)
      throw new Error("Polar order already belongs to another checkout.");
    if (
      ![order.netAmount, order.refundedAmount, order.totalAmount].every(
        (amount) => Number.isSafeInteger(amount) && amount >= 0,
      ) ||
      order.netAmount <= 0 ||
      order.totalAmount !== purchase.priceAmount
    )
      throw new Error("Invalid Polar legendary order amount.");
    const refundedFraction = Math.max(
      purchase.refundedFraction,
      order.status === "refunded"
        ? 1
        : Math.min(order.refundedAmount / order.netAmount, 1),
    );
    const retained = (amount: number, fraction: number) =>
      amount - Math.floor(amount * fraction);
    const delta = (amount: number) =>
      retained(amount, refundedFraction) -
      (purchase.fulfilled ? retained(amount, purchase.refundedFraction) : 0);
    const emeraldDelta = delta(purchase.emeralds);
    const goldDelta = delta(purchase.gold);
    await migratePlayerCatalogue(ctx, purchase.ownerId, true);
    if (emeraldDelta || goldDelta) {
      const wallet = await ensureEmeraldWallet(ctx, purchase.ownerId);
      await ctx.db.patch(wallet._id, {
        diamonds: wallet.diamonds! + emeraldDelta,
        gold: wallet.gold + goldDelta,
      });
    }
    const additions = purchase.cards
      .map((card) => ({ variantId: card.variantId, count: delta(card.count) }))
      .filter((card) => card.count > 0);
    if (additions.length) await grantLoot(ctx, purchase.ownerId, additions);
    for (const card of purchase.cards) {
      const change = delta(card.count);
      if (change >= 0) continue;
      const entry = await ownedCard(ctx, purchase.ownerId, card.variantId);
      if (!entry) throw new Error("Purchased card missing during refund.");
      const copies = entry.copies + change;
      // First copies unlock a card. Remove an unused unlock with no copies left;
      // spent reserves become a debt, like spent currencies, without undoing levels.
      if (entry.level === 1 && copies === -1) await ctx.db.delete(entry._id);
      else await ctx.db.patch(entry._id, { copies });
    }
    await ctx.db.patch(purchase._id, {
      orderId: order.orderId,
      status: refundedFraction === 1 ? "refunded" : "paid",
      fulfilled: true,
      refundedFraction,
    });
  },
});

export const legendaryCheckoutStatus = query({
  args: { checkoutId: v.string() },
  handler: async (
    ctx,
    { checkoutId },
  ): Promise<LegendaryPaymentStatus | null> => {
    const { userId } = await requirePlayer(ctx);
    const purchase = await ctx.db
      .query("legendaryPurchases")
      .withIndex("by_checkout", (q) => q.eq("checkoutId", checkoutId))
      .unique();
    if (!purchase || purchase.ownerId !== userId) return null;
    const retained = (count: number) =>
      purchase.fulfilled
        ? count - Math.floor(count * purchase.refundedFraction)
        : 0;
    return {
      status: purchase.status,
      offerId: purchase.offerId,
      emeralds: retained(purchase.emeralds),
      gold: retained(purchase.gold),
      cards: purchase.cards.map((card) => ({
        ...card,
        count: retained(card.count),
      })),
    };
  },
});
