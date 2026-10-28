import { Polar } from "@convex-dev/polar";
import { ConvexError } from "convex/values";
import { api, components } from "./_generated/api";
import type { DataModel } from "./_generated/dataModel";

export const polar: Polar<DataModel> = new Polar(components.polar, {
  getUserInfo: async (ctx): Promise<{ userId: string; email: string }> => {
    const user = await ctx.runQuery(api.auth.getCurrentUser, {});
    if (!user) throw new ConvexError("Connecte-toi pour effectuer un achat.");
    return { userId: String(user._id), email: user.email };
  },
});
