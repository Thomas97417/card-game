import { ConvexError } from "convex/values";
import { Leaf, LoaderCircle } from "lucide-react";
import { toast } from "sonner";

export function showGameError(error: unknown) {
  toast.error(
    error instanceof ConvexError && typeof error.data === "string"
      ? error.data
      : error instanceof Error
        ? error.message
        : "Une erreur est survenue. Réessaie.",
  );
}
export function GameLoading() {
  return (
    <div className="game-loading" role="status">
      <LoaderCircle className="animate-spin" />
      <span>La forêt s’éveille…</span>
    </div>
  );
}
export function PageTitle({
  eyebrow,
  title,
  description,
}: {
  eyebrow: string;
  title: string;
  description: string;
}) {
  return (
    <div className="page-title">
      <span className="eyebrow">
        <Leaf size={13} />
        {eyebrow}
      </span>
      <h1>{title}</h1>
      <p>{description}</p>
    </div>
  );
}
