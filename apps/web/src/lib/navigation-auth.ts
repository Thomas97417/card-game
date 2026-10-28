type AuthSnapshot = { isAuthenticated: boolean; token?: string };

/** One instance per router/request. Live session validation replaces the bootstrap. */
export function createNavigationAuth() {
  let snapshot: AuthSnapshot | undefined;
  let pending: Promise<AuthSnapshot> | undefined;

  return {
    load(getToken: () => Promise<string | undefined>): Promise<AuthSnapshot> {
      if (snapshot) return Promise.resolve(snapshot);
      if (!pending) {
        pending = getToken()
          .then((token) => {
            snapshot ??= { isAuthenticated: !!token, token };
            return snapshot;
          })
          .finally(() => { pending = undefined; });
      }
      return pending;
    },
    update(isAuthenticated: boolean) {
      // Tokens are only needed to bootstrap the provider. Convex refreshes them.
      snapshot = { isAuthenticated };
    },
  };
}

export type NavigationAuth = ReturnType<typeof createNavigationAuth>;
