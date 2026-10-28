/** React waits for these styles before showing the next screen, and retains
 * them across route changes. Shared styles always precede page styles. */
export function stylesheet(href: string, precedence: "app" | "page" = "page") {
  return { rel: "stylesheet", href, precedence } as const;
}
