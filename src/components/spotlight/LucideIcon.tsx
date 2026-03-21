import * as PhosphorIcons from "@phosphor-icons/react";

interface Props {
  name: string;
  className?: string;
  size?: number;
}

export function LucideIcon({ name, className, size = 16 }: Props) {
  const rawName = name.replace(/^(ph|lucide):/, "");

  const pascalName = rawName
    .split("-")
    .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
    .join("");

  // Phosphor exports some icons with and without "Icon" suffix
  const icons = PhosphorIcons as Record<string, unknown>;
  const Icon = (icons[pascalName] ?? icons[pascalName + "Icon"]) as
    | React.ComponentType<{ size?: number; className?: string }>
    | undefined;

  if (!Icon) return null;

  return <Icon size={size} className={className} />;
}
