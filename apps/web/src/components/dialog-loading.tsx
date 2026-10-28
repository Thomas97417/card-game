import { LoaderCircle } from "lucide-react";
import { Dialog, DialogContent, DialogTitle } from "./ui/dialog";

export function DialogLoading({ title, onClose }: { title: string; onClose: () => void }) {
  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent appearance="game" aria-describedby={undefined}>
        <DialogTitle>{title}</DialogTitle>
        <p role="status" className="flex items-center gap-2 py-6 text-sm">
          <LoaderCircle className="animate-spin" size={18} aria-hidden="true" />
          Chargement…
        </p>
      </DialogContent>
    </Dialog>
  );
}
