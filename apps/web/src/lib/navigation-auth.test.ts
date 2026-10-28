import { describe, expect, it, vi } from "vitest";
import { createNavigationAuth } from "./navigation-auth";

describe("navigation session bootstrap", () => {
  it("shares the bootstrap across concurrent preloads and later navigations", async () => {
    const auth = createNavigationAuth();
    const getToken = vi.fn().mockResolvedValue("bootstrap-token");
    const [first, preload] = await Promise.all([auth.load(getToken), auth.load(getToken)]);
    expect(first).toEqual({ isAuthenticated: true, token: "bootstrap-token" });
    expect(preload).toEqual(first);
    await auth.load(getToken);
    expect(getToken).toHaveBeenCalledOnce();
  });

  it("uses live session expiry and sign-in without another token round trip", async () => {
    const auth = createNavigationAuth();
    const getToken = vi.fn().mockResolvedValue("bootstrap-token");
    await auth.load(getToken);
    auth.update(false);
    expect(await auth.load(getToken)).toEqual({ isAuthenticated: false });
    auth.update(true);
    expect(await auth.load(getToken)).toEqual({ isAuthenticated: true });
    expect(getToken).toHaveBeenCalledOnce();
  });

  it("does not let a late bootstrap restore an expired session", async () => {
    const auth = createNavigationAuth();
    let resolve!: (token: string) => void;
    const pending = auth.load(() => new Promise((done) => { resolve = done; }));
    auth.update(false);
    resolve("obsolete-token");
    expect(await pending).toEqual({ isAuthenticated: false });
  });

  it("keeps different routers and server requests independent", async () => {
    const first = createNavigationAuth();
    const second = createNavigationAuth();
    await first.load(async () => "first-player-token");
    expect(await second.load(async () => undefined)).toEqual({ isAuthenticated: false, token: undefined });
  });

  it("allows retrying a failed bootstrap", async () => {
    const auth = createNavigationAuth();
    const getToken = vi.fn().mockRejectedValueOnce(new Error("Network unavailable")).mockResolvedValue("token");
    await expect(auth.load(getToken)).rejects.toThrow("Network unavailable");
    expect(await auth.load(getToken)).toEqual({ isAuthenticated: true, token: "token" });
  });
});
