import { useState, type ComponentProps } from "react";
import { Input } from "./input";
import { Eye, EyeOff } from "lucide-react";
import { cn } from "@/lib/utils";

export default function PasswordInput({
  className,
  visibilityLabel = "le mot de passe",
  ...props
}: Omit<ComponentProps<typeof Input>, "type"> & { visibilityLabel?: string }) {
  const [visible, setVisible] = useState(false);

  return (
    <div className={cn("relative w-full", className)}>
      <Input
        {...props}
        type={visible ? "text" : "password"}
        required={props.required ?? true}
        className="bg-transparent pr-11"
      />
      <button
        type="button"
        aria-label={
          `${visible ? "Masquer" : "Afficher"} ${visibilityLabel}`
        }
        aria-pressed={visible}
        aria-controls={props.id}
        disabled={props.disabled}
        className="password-visibility-toggle text-muted-foreground hover:text-foreground absolute top-1/2 right-2 -translate-y-1/2 cursor-pointer transition-colors"
        onClick={() => setVisible((v) => !v)}
      >
        {visible ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
      </button>
    </div>
  );
}
