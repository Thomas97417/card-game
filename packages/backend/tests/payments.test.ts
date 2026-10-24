import { convexTest } from "convex-test";
import betterAuthTest from "@convex-dev/better-auth/test";
import polarTest from "@convex-dev/polar/test";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { EMERALD_PACKS } from "@sylve/game/emerald-packs";
import { WELCOME_DIAMONDS } from "@sylve/game/summoning";
import { api, components, internal } from "../convex/_generated/api";
import schema from "../convex/schema";

const modules = import.meta.glob("../convex/**/*.ts");
const webhookSecret = "polar-local-test-signing-secret";
beforeEach(() => {
  vi.stubEnv("SITE_URL", "https://sylve.example");
  vi.stubEnv("POLAR_ORGANIZATION_TOKEN", "test-token");
  vi.stubEnv("POLAR_WEBHOOK_SECRET", webhookSecret);
  vi.stubEnv("POLAR_SERVER", "sandbox");
  for (const pack of EMERALD_PACKS)
    vi.stubEnv(
      `POLAR_PRODUCT_EMERALDS_${pack.id.toUpperCase()}`,
      `product-${pack.id}`,
    );
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});

function setup() {
  const t = convexTest(schema, modules);
  betterAuthTest.register(t);
  polarTest.register(t);
  return t;
}
type Test = ReturnType<typeof setup>;
async function player(t: Test, name = "alice") {
  const now = Date.now();
  const user = await t.mutation(components.betterAuth.adapter.create, {
    input: {
      model: "user",
      data: {
        name,
        email: `${name}@example.invalid`,
        emailVerified: true,
        createdAt: now,
        updatedAt: now,
      },
    },
  });
  const session = await t.mutation(components.betterAuth.adapter.create, {
    input: {
      model: "session",
      data: {
        userId: user._id,
        token: `${name}-session`,
        createdAt: now,
        updatedAt: now,
        expiresAt: now + 86_400_000,
      },
    },
  });
  return {
    userId: String(user._id),
    client: t.withIdentity({ subject: user._id, sessionId: session._id }),
  };
}
function product(id = "pouch") {
  const timestamp = new Date().toISOString();
  return {
    id: `product-${id}`,
    name: id,
    createdAt: timestamp,
    modifiedAt: timestamp,
    description: null,
    recurringInterval: null,
    isRecurring: false,
    isArchived: false,
    organizationId: "organization-test",
    medias: [],
    prices: [
      {
        id: `price-${id}`,
        productId: `product-${id}`,
        createdAt: timestamp,
        modifiedAt: timestamp,
        isArchived: false,
        type: "one_time",
        amountType: "fixed",
        priceAmount: 499,
        priceCurrency: "eur",
      },
    ],
  };
}
async function pendingPurchase(
  t: Test,
  ownerId: string,
  checkoutId = "checkout-test",
) {
  await t.mutation(internal.payments.recordCheckout, {
    ownerId,
    checkoutId,
    customerId: "customer-test",
    productId: "product-pouch",
    packId: "pouch",
    emeralds: 500,
    priceAmount: 499,
    priceCurrency: "eur",
  });
}
const paidOrder = (checkoutId = "checkout-test", orderId = "order-test") => ({
  kind: "paid" as const,
  orderId,
  checkoutId,
  customerId: "customer-test",
  productId: "product-pouch",
  currency: "eur",
  paid: true,
  status: "paid",
  netAmount: 499,
  refundedAmount: 0,
});
async function balance(t: Test, ownerId: string) {
  return t.run((ctx) =>
    ctx.db
      .query("wallets")
      .withIndex("by_owner", (q) => q.eq("ownerId", ownerId))
      .unique(),
  );
}

// A real SDK payload and HMAC exercise the component's signature check and routing.
function orderEvent(
  type = "order.paid",
  changes: Record<string, unknown> = {},
) {
  const timestamp = new Date().toISOString();
  return {
    type,
    timestamp,
    data: {
      id: "order-test",
      created_at: timestamp,
      modified_at: timestamp,
      status: "paid",
      paid: true,
      subtotal_amount: 499,
      discount_amount: 0,
      net_amount: 499,
      tax_amount: 100,
      total_amount: 599,
      applied_balance_amount: 0,
      due_amount: 0,
      refunded_amount: 0,
      refunded_tax_amount: 0,
      currency: "eur",
      billing_reason: "purchase",
      billing_name: null,
      billing_address: null,
      invoice_number: "TEST-001",
      is_invoice_generated: false,
      customer_id: "customer-test",
      product_id: "product-pouch",
      discount_id: null,
      subscription_id: null,
      checkout_id: "checkout-test",
      metadata: { purpose: "emerald_pack" },
      platform_fee_amount: 0,
      platform_fee_currency: null,
      customer: {
        id: "customer-test",
        created_at: timestamp,
        modified_at: timestamp,
        metadata: {},
        email: "alice@example.invalid",
        email_verified: true,
        type: "individual",
        name: "Alice",
        billing_address: null,
        tax_id: null,
        organization_id: "organization-test",
        deleted_at: null,
        avatar_url: "",
      },
      product: null,
      discount: null,
      subscription: null,
      items: [],
      description: "Bourse d’émeraudes",
      ...changes,
    },
  };
}
async function sendWebhook(
  t: Test,
  event: ReturnType<typeof orderEvent>,
  secret = webhookSecret,
) {
  const body = JSON.stringify(event);
  const id = crypto.randomUUID();
  const timestamp = String(Math.floor(Date.now() / 1000));
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign(
    "HMAC",
    key,
    encoder.encode(`${id}.${timestamp}.${body}`),
  );
  return t.fetch("/polar/events", {
    method: "POST",
    body,
    headers: {
      "content-type": "application/json",
      "webhook-id": id,
      "webhook-timestamp": timestamp,
      "webhook-signature": `v1,${btoa(String.fromCharCode(...new Uint8Array(signature)))}`,
    },
  });
}

describe("achats d’émeraudes avec Polar", () => {
  it("requires a real authenticated player for offers, checkout and purchase status", async () => {
    const t = setup();
    await expect(t.query(api.payments.offers, {})).rejects.toThrow(
      "Connecte-toi",
    );
    await expect(
      t.action(api.payments.createCheckout, { packId: "pouch" }),
    ).rejects.toThrow("Connecte-toi");
    await expect(
      t.query(api.payments.checkoutStatus, { checkoutId: "x" }),
    ).rejects.toThrow("Connecte-toi");
  });

  it("reads the real fixed one-time price from the component and disables unconfigured packs", async () => {
    const t = setup();
    const { client } = await player(t);
    await t.mutation(components.polar.lib.createProduct, {
      product: product(),
    });
    const offers = await client.query(api.payments.offers, {});
    expect(offers).toHaveLength(5);
    expect(offers[0]).toEqual({
      id: "pouch",
      priceAmount: 499,
      priceCurrency: "eur",
      available: true,
    });
    expect(
      offers
        .slice(1)
        .every((offer) => !offer.available && offer.priceAmount === null),
    ).toBe(true);
    vi.stubEnv("POLAR_WEBHOOK_SECRET", "");
    expect(
      (await client.query(api.payments.offers, {})).every(
        (offer) => !offer.available,
      ),
    ).toBe(true);
  });

  it.each([
    "recurring",
    "archived",
    "free",
    "custom",
    "foreign-currency",
    "multiple-prices",
    "duplicate-product",
  ])("rejects an unsuitable %s offer", async (invalid) => {
    const t = setup();
    const { client } = await player(t);
    const item = product();
    if (invalid === "recurring") item.isRecurring = true;
    if (invalid === "archived") item.isArchived = true;
    if (invalid === "free") item.prices[0].priceAmount = 0;
    if (invalid === "custom") item.prices[0].amountType = "custom";
    if (invalid === "foreign-currency") item.prices[0].priceCurrency = "usd";
    if (invalid === "multiple-prices")
      item.prices.push({ ...item.prices[0], id: "price-second" });
    if (invalid === "duplicate-product")
      vi.stubEnv("POLAR_PRODUCT_EMERALDS_COFFER", "product-pouch");
    await t.mutation(components.polar.lib.createProduct, { product: item });
    expect((await client.query(api.payments.offers, {}))[0].available).toBe(
      false,
    );
    await expect(
      client.action(api.payments.createCheckout, { packId: "pouch" }),
    ).rejects.toThrow("indisponible");
  });

  it("binds checkout to the authenticated player and server catalog without crediting on redirect", async () => {
    const t = setup();
    const alice = await player(t);
    const bob = await player(t, "bob");
    await t.mutation(components.polar.lib.createProduct, {
      product: product(),
    });
    const { polar } = await import("../convex/polar");
    const create = vi.spyOn(polar, "createCheckoutSession").mockResolvedValue({
      id: "checkout-test",
      customerId: "customer-test",
      url: "https://sandbox.polar.sh/checkout/test",
      amount: 499,
      currency: "eur",
    } as Awaited<ReturnType<typeof polar.createCheckoutSession>>);
    const checkout = await alice.client.action(api.payments.createCheckout, {
      packId: "pouch",
    });
    expect(checkout.url).toBe(
      "https://sandbox.polar.sh/checkout/test?locale=fr",
    );
    expect(create.mock.calls[0][1]).toEqual({
      productIds: ["product-pouch"],
      userId: alice.userId,
      email: "alice@example.invalid",
      origin: "https://sylve.example",
      successUrl: "https://sylve.example/sanctuary?checkout={CHECKOUT_ID}",
      metadata: {
        purpose: "emerald_pack",
        packId: "pouch",
        userId: alice.userId,
      },
    });
    expect(
      await alice.client.query(api.payments.checkoutStatus, {
        checkoutId: "checkout-test",
      }),
    ).toEqual({ status: "pending", emeralds: 0 });
    expect(await balance(t, alice.userId)).toBeNull();
    expect(
      await bob.client.query(api.payments.checkoutStatus, {
        checkoutId: "checkout-test",
      }),
    ).toBeNull();
    expect(
      await alice.client.query(api.payments.checkoutStatus, {
        checkoutId: "forged",
      }),
    ).toBeNull();
    await expect(
      alice.client.action(api.payments.createCheckout, {
        packId: "pouch",
        emeralds: 999999,
      } as never),
    ).rejects.toThrow();
  });

  it("does not open a checkout if the provider price changed since the offer was synced", async () => {
    const t = setup();
    const { client } = await player(t);
    await t.mutation(components.polar.lib.createProduct, {
      product: product(),
    });
    const { polar } = await import("../convex/polar");
    vi.spyOn(polar, "createCheckoutSession").mockResolvedValue({
      id: "checkout-test",
      customerId: "customer-test",
      amount: 599,
      currency: "eur",
    } as Awaited<ReturnType<typeof polar.createCheckoutSession>>);
    await expect(
      client.action(api.payments.createCheckout, { packId: "pouch" }),
    ).rejects.toThrow("vient de changer");
    expect(
      await t.run((ctx) => ctx.db.query("emeraldPurchases").collect()),
    ).toHaveLength(0);
  });

  it("fulfills a genuinely signed paid webhook once, including concurrent deliveries", async () => {
    const t = setup();
    const { userId, client } = await player(t);
    await pendingPurchase(t, userId);
    expect((await sendWebhook(t, orderEvent("order.created"))).status).toBe(
      202,
    );
    expect(await balance(t, userId)).toBeNull();
    const responses = await Promise.all([
      sendWebhook(t, orderEvent()),
      sendWebhook(t, orderEvent()),
    ]);
    expect(responses.map((response) => response.status)).toEqual([202, 202]);
    expect((await balance(t, userId))?.diamonds).toBe(WELCOME_DIAMONDS + 500);
    expect(
      await client.query(api.payments.checkoutStatus, {
        checkoutId: "checkout-test",
      }),
    ).toEqual({ status: "paid", emeralds: 500 });
    expect((await sendWebhook(t, orderEvent("order.created"))).status).toBe(
      202,
    );
    expect((await balance(t, userId))?.diamonds).toBe(WELCOME_DIAMONDS + 500);
  });

  it("rejects a forged webhook signature without changing the wallet", async () => {
    const t = setup();
    const { userId } = await player(t);
    await pendingPurchase(t, userId);
    vi.spyOn(console, "error").mockImplementation(() => {});
    expect((await sendWebhook(t, orderEvent(), "forged-secret")).status).toBe(
      403,
    );
    expect(await balance(t, userId)).toBeNull();
  });

  it("does not fulfill an unpaid order or acknowledge a missing checkout", async () => {
    const t = setup();
    const { userId } = await player(t);
    await pendingPurchase(t, userId);
    await t.mutation(internal.payments.processOrder, {
      ...paidOrder(),
      paid: false,
      status: "pending",
    });
    expect(await balance(t, userId)).toBeNull();
    await expect(
      t.mutation(internal.payments.processOrder, paidOrder("missing")),
    ).rejects.toThrow("retry this webhook");
  });

  it.each(["customerId", "productId", "currency"] as const)(
    "rejects an order with the wrong %s",
    async (field) => {
      const t = setup();
      const { userId } = await player(t);
      await pendingPurchase(t, userId);
      await expect(
        t.mutation(internal.payments.processOrder, {
          ...paidOrder(),
          [field]: "wrong",
        }),
      ).rejects.toThrow("does not match");
      expect(await balance(t, userId)).toBeNull();
    },
  );

  it("keeps gold and an exhausted emerald wallet intact, serializing separate purchases", async () => {
    const t = setup();
    const { userId } = await player(t);
    await t.run((ctx) =>
      ctx.db.insert("wallets", { ownerId: userId, gold: 725, diamonds: 0 }),
    );
    await pendingPurchase(t, userId, "first");
    await pendingPurchase(t, userId, "second");
    await Promise.all([
      t.mutation(internal.payments.processOrder, paidOrder("first", "order-1")),
      t.mutation(
        internal.payments.processOrder,
        paidOrder("second", "order-2"),
      ),
    ]);
    expect(await balance(t, userId)).toMatchObject({
      gold: 725,
      diamonds: 1000,
    });
  });

  it("migrates a legacy wallet once when payment arrives before first visiting sanctuary", async () => {
    const t = setup();
    const { userId, client } = await player(t);
    await t.run((ctx) =>
      ctx.db.insert("wallets", { ownerId: userId, gold: 725 }),
    );
    await pendingPurchase(t, userId);
    await t.mutation(internal.payments.processOrder, paidOrder());
    await client.mutation(api.sanctuary.ensureWallet, {});
    expect(await balance(t, userId)).toMatchObject({
      gold: 725,
      diamonds: WELCOME_DIAMONDS + 500,
    });
  });

  it("applies cumulative partial and full refunds once and ignores late paid replays", async () => {
    const t = setup();
    const { userId, client } = await player(t);
    await pendingPurchase(t, userId);
    await sendWebhook(t, orderEvent());
    const refund = orderEvent("order.refunded", {
      status: "partially_refunded",
      refunded_amount: 250,
    });
    expect((await sendWebhook(t, refund)).status).toBe(202);
    await sendWebhook(t, refund);
    expect((await balance(t, userId))?.diamonds).toBe(WELCOME_DIAMONDS + 250);
    await sendWebhook(
      t,
      orderEvent("order.refunded", {
        status: "refunded",
        refunded_amount: 499,
      }),
    );
    await sendWebhook(t, orderEvent());
    expect((await balance(t, userId))?.diamonds).toBe(WELCOME_DIAMONDS);
    expect(
      await client.query(api.payments.checkoutStatus, {
        checkoutId: "checkout-test",
      }),
    ).toEqual({ status: "refunded", emeralds: 0 });
  });

  it("handles a refund arriving before the paid event without ever granting the refunded emeralds", async () => {
    const t = setup();
    const { userId } = await player(t);
    await pendingPurchase(t, userId);
    await sendWebhook(
      t,
      orderEvent("order.refunded", {
        status: "refunded",
        refunded_amount: 499,
      }),
    );
    await sendWebhook(t, orderEvent());
    expect(await balance(t, userId)).toBeNull();
  });

  it("preserves a refund debt after already spending the purchased emeralds", async () => {
    const t = setup();
    const { userId, client } = await player(t);
    await pendingPurchase(t, userId);
    await sendWebhook(t, orderEvent());
    await t.run(async (ctx) => {
      const wallet = await ctx.db
        .query("wallets")
        .withIndex("by_owner", (q) => q.eq("ownerId", userId))
        .unique();
      await ctx.db.patch(wallet!._id, { diamonds: 0 });
    });
    await sendWebhook(
      t,
      orderEvent("order.refunded", {
        status: "refunded",
        refunded_amount: 499,
      }),
    );
    expect(await client.mutation(api.sanctuary.ensureWallet, {})).toBe(-500);
    await pendingPurchase(t, userId, "next-checkout");
    await t.mutation(
      internal.payments.processOrder,
      paidOrder("next-checkout", "next-order"),
    );
    expect((await balance(t, userId))?.diamonds).toBe(0);
  });
});
