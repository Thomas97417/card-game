import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";

export function SettingsCard({
  children,
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div className={cn("settings-card", className)} {...props}>
      {children}
    </div>
  );
}

export function SettingsCardContent({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("settings-card-content", className)}>{children}</div>
  );
}

export function SettingsCardFooter({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("settings-card-footer", className)}>{children}</div>
  );
}

export function SettingsCardHeader({
  title,
  description,
  icon: Icon,
}: {
  title: string;
  description: string;
  icon?: LucideIcon;
}) {
  return (
    <div className="settings-card-heading">
      {Icon && (
        <span className="settings-card-icon">
          <Icon size={21} aria-hidden="true" />
        </span>
      )}
      <div>
        <h2>{title}</h2>
        <p>{description}</p>
      </div>
    </div>
  );
}
