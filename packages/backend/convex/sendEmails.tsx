"use node";
import { Resend } from "@convex-dev/resend";
import { v } from "convex/values";
import { components } from "./_generated/api";
import { internalAction } from "./_generated/server";
import { SITE_URL } from "./env";
import { renderAuthEmail } from "./lib/auth-email";

export const resend: Resend = new Resend(components.resend, {
  testMode: false,
});

export const sendResetPasswordEmail = internalAction({
  args: {
    from: v.string(),
    to: v.string(),
    url: v.string(),
  },
  handler: async (ctx, { from, to, url }) => {
    const email = await renderAuthEmail({ kind: "password-reset", url, siteUrl: SITE_URL });
    await resend.sendEmail(ctx, { from, to, ...email });
  },
});

export const sendVerificationEmail = internalAction({
  args: {
    from: v.string(),
    to: v.string(),
    url: v.string(),
    token: v.string(),
  },
  handler: async (ctx, { from, to, url }) => {
    const email = await renderAuthEmail({ kind: "verification", url, siteUrl: SITE_URL });
    await resend.sendEmail(ctx, { from, to, ...email });
  },
});
