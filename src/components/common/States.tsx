import { AlertCircle, ArrowUpRight, LoaderCircle, Plus } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

export function UpcomingButton({
  children,
  icon: Icon = Plus,
}: {
  children: ReactNode;
  icon?: LucideIcon;
}) {
  return (
    <span
      className="upcoming-control"
      tabIndex={0}
      aria-label={`${children}: coming in a later phase`}
    >
      <button className="button" disabled>
        <Icon size={16} />
        {children}
        <span className="soon">Soon</span>
      </button>
      <span role="tooltip" className="tooltip">
        Available in a later phase
      </span>
    </span>
  );
}

export function PageHeader({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow: string;
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <header className="page-header">
      <div>
        <p className="eyebrow">{eyebrow}</p>
        <h1>{title}</h1>
        <p className="description">{description}</p>
      </div>
      {action}
    </header>
  );
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  children,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
  children?: ReactNode;
}) {
  return (
    <div className="empty-state">
      <div className="empty-icon">
        <Icon size={27} strokeWidth={1.3} />
      </div>
      <h2>{title}</h2>
      <p>{description}</p>
      {children}
    </div>
  );
}

export function LoadingState({
  message = "Loading your local workspace…",
}: {
  message?: string;
}) {
  return (
    <div className="inline-state" role="status">
      <LoaderCircle size={17} className="spin" />
      {message}
    </div>
  );
}

export function ErrorState({
  message,
  onRetry,
}: {
  message: string;
  onRetry: () => void;
}) {
  return (
    <div className="error-state" role="alert">
      <AlertCircle size={18} />
      <p>{message}</p>
      <button className="text-button" onClick={onRetry}>
        Try again <ArrowUpRight size={14} />
      </button>
    </div>
  );
}
