import type { FormEvent, ReactNode } from "react";
import { ArrowRight, CircleAlert, LoaderCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";

export async function submitAuthForm(event: FormEvent<HTMLFormElement>, submit: () => Promise<unknown>) {
  event.preventDefault();
  const element = event.currentTarget;
  await submit();
  window.setTimeout(() => element.querySelector<HTMLInputElement>('[aria-invalid="true"]')?.focus(), 0);
}

export function AuthHeading({ title, children }: { title: string; children: ReactNode }) {
  return (
    <header className="auth-form-heading">
      <h1>{title}</h1>
      <p>{children}</p>
    </header>
  );
}

export function AuthField({
  id,
  label,
  errors,
  action,
  descriptionId,
  children,
}: {
  id: string;
  label: string;
  errors: readonly unknown[];
  action?: ReactNode;
  descriptionId?: string;
  children: (props: { id: string; "aria-invalid": boolean; "aria-describedby"?: string }) => ReactNode;
}) {
  const messages = errors.flatMap((error) => {
    if (typeof error === "string") return [error];
    if (error && typeof error === "object" && "message" in error && typeof error.message === "string") return [error.message];
    return [];
  });
  const describedBy = [descriptionId, messages.length ? `${id}-error` : undefined].filter(Boolean).join(" ") || undefined;
  return (
    <div className="auth-field">
      <div className="auth-field-label"><Label htmlFor={id}>{label}</Label>{action}</div>
      {children({ id, "aria-invalid": messages.length > 0, "aria-describedby": describedBy })}
      {messages.length > 0 && <p className="auth-field-error" id={`${id}-error`} role="alert">{messages.join(" ")}</p>}
    </div>
  );
}

export function AuthNotice({ children, success = false }: { children: ReactNode; success?: boolean }) {
  return (
    <div className={`auth-notice${success ? " is-success" : ""}`} role={success ? "status" : "alert"}>
      {!success && <CircleAlert size={19} aria-hidden="true" />}
      <div>{children}</div>
    </div>
  );
}

export function AuthSubmit({
  pending,
  disabled,
  pendingLabel,
  children,
}: {
  pending: boolean;
  disabled: boolean;
  pendingLabel: string;
  children: ReactNode;
}) {
  return (
    <Button type="submit" className="auth-submit" disabled={disabled || pending} aria-busy={pending}>
      {pending ? pendingLabel : children}
      {pending ? <LoaderCircle size={18} className="auth-spinner" aria-hidden="true" /> : <ArrowRight size={18} aria-hidden="true" />}
    </Button>
  );
}

export function AuthStateArt({ success = true }: { success?: boolean }) {
  return <img className="auth-state-art" src={success ? "/art/ui/mission-check.webp" : "/art/ui/archives-book.webp"} alt="" width={96} height={96} />;
}
