import * as PhosphorIcons from "@phosphor-icons/react";

interface Props {
  name: string;
  className?: string;
  size?: number;
}

// Plugin authors often use Lucide icon names (the project migrated from
// Lucide to Phosphor). Map the common ones onto Phosphor equivalents so
// plugin icons don't silently render as blank.
const LUCIDE_ALIASES: Record<string, string> = {
  "alert-circle": "WarningCircle",
  "alert-triangle": "Warning",
  "check-circle": "CheckCircle",
  "x-circle": "XCircle",
  x: "X",
  search: "MagnifyingGlass",
  settings: "Gear",
  cog: "Gear",
  trash: "Trash",
  "trash-2": "Trash",
  edit: "Pencil",
  pencil: "Pencil",
  "external-link": "ArrowSquareOut",
  file: "File",
  folder: "Folder",
  info: "Info",
  github: "GithubLogo",
  wifi: "WifiHigh",
  "wifi-off": "WifiSlash",
  clock: "Clock",
  bookmark: "Bookmark",
  calculator: "Calculator",
  globe: "Globe",
  palette: "Palette",
  key: "Key",
  network: "Network",
  activity: "Activity",
  "map-pin": "MapPin",
  shield: "Shield",
  chrome: "Browser",
  browser: "Browser",
  server: "HardDrives",
  database: "Database",
  monitor: "Desktop",
  terminal: "Terminal",
  code: "Code",
  link: "Link",
  copy: "Copy",
  check: "Check",
  plus: "Plus",
  minus: "Minus",
  "arrow-right": "ArrowRight",
  "chevron-right": "CaretRight",
  "chevron-down": "CaretDown",
  sun: "Sun",
  moon: "Moon",
  star: "Star",
  heart: "Heart",
  user: "User",
  users: "Users",
  home: "House",
  mail: "Envelope",
  message: "Chat",
  image: "Image",
  music: "MusicNote",
  play: "Play",
  pause: "Pause",
  download: "Download",
  upload: "Upload",
  refresh: "ArrowsClockwise",
  zap: "Lightning",
  cpu: "Cpu",
  layers: "Stack",
  package: "Package",
  tag: "Tag",
  calendar: "Calendar",
  filter: "Funnel",
  grid: "SquaresFour",
  list: "List",
  lock: "Lock",
  unlock: "LockOpen",
  eye: "Eye",
  "eye-off": "EyeSlash",
  power: "Power",
};

export function LucideIcon({ name, className, size = 16 }: Props) {
  const rawName = name.replace(/^(ph|lucide):/, "");
  const alias = LUCIDE_ALIASES[rawName];
  const pascalName =
    alias ??
    rawName
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
