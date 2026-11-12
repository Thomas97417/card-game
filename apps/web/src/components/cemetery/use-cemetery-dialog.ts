import { useEffect, type RefObject } from "react";

/** Keeps keyboard navigation in the current pause, level-up or results dialog. */
export function useCemeteryDialog(
  root: RefObject<HTMLElement | null>,
  key: string | boolean,
) {
  useEffect(() => {
    if (!key) return;
    const dialog = root.current?.querySelector<HTMLElement>(
      '[role="dialog"], [role="alertdialog"]',
    );
    if (!dialog) return;
    const previous = document.activeElement as HTMLElement | null;
    const buttons = () =>
      Array.from(
        dialog.querySelectorAll<HTMLElement>(
          'button:not(:disabled), a[href], [tabindex="0"]',
        ),
      );
    dialog.tabIndex = -1;
    (buttons()[0] ?? dialog).focus();
    const trap = (event: KeyboardEvent) => {
      if (event.key !== "Tab") return;
      const list = buttons(),
        first = list[0],
        last = list[list.length - 1];
      if (!first) {
        event.preventDefault();
        dialog.focus();
        return;
      }
      if (
        event.shiftKey &&
        (document.activeElement === first || document.activeElement === dialog)
      ) {
        event.preventDefault();
        last!.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    dialog.addEventListener("keydown", trap);
    return () => {
      dialog.removeEventListener("keydown", trap);
      if (previous?.isConnected) previous.focus();
    };
  }, [root, key]);
}
