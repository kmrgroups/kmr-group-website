import { ReactNode } from "react";

/**
 * Signature visual element for the site: an engraved "spec plate" card,
 * styled like an industrial nameplate. Used for leadership bios, vertical
 * cards and product cards so the whole site reads as one engineered system.
 */
export default function SpecPlate({
  eyebrow,
  title,
  children,
  dark = false,
  className = ""
}: {
  eyebrow?: string;
  title: string;
  children?: ReactNode;
  dark?: boolean;
  className?: string;
}) {
  return (
    <div
      className={`plate ${dark ? "plate-dark bg-ink text-warehouse" : "bg-white"} p-6 ${className}`}
    >
      {eyebrow && <p className={`eyebrow mb-2 ${dark ? "text-copper-light" : "text-steel"}`}>{eyebrow}</p>}
      <h3 className="font-display text-2xl leading-tight mb-2">{title}</h3>
      {children}
    </div>
  );
}
