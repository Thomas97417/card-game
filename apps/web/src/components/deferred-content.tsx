import { Suspense, useEffect, useState, type ReactNode } from "react";

/** Load on first use, then retain drafts, dialog transitions and in-flight actions. */
export function DeferredContent({ active, fallback, children }: {
  active: boolean;
  fallback: ReactNode;
  children: ReactNode;
}) {
  const [activated, setActivated] = useState(active);
  useEffect(() => {
    if (active && !activated) setActivated(true);
  }, [active, activated]);
  if (!active && !activated) return null;
  return <Suspense fallback={active ? fallback : null}>{children}</Suspense>;
}
