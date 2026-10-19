import {
  BellRing,
  Briefcase,
  CalendarDays,
  ChartColumn,
  ClipboardList,
  Ellipsis,
  House,
  Inbox,
  MessageSquare,
  Settings,
  SlidersHorizontal,
  Users,
  Wallet,
  type LucideIcon,
} from "lucide-react";

// Role and ROLES now live in src/lib/auth/roles.ts so the route guard can use them without icons.
import { ROLES, type Role } from "@/lib/auth/roles";

export { ROLES, type Role };

export type NavItem = {
  label: string;
  /** Last URL segment. Empty for the role home. */
  slug: string;
  icon: LucideIcon;
  /** Phase in phases-plan.md that builds the real screen. Used by placeholders. */
  phase: number;
  /** Admin only. Shown inline on desktop, behind More on phones. */
  overflow?: boolean;
};

export type RoleNavConfig = {
  home: string;
  items: readonly NavItem[];
};

/** Tab order follows design plan.md wireframes 2, 4 and 5. */
export const NAV: Record<Role, RoleNavConfig> = {
  customer: {
    home: "/customer",
    items: [
      { label: "Home", slug: "", icon: House, phase: 6 },
      { label: "Bookings", slug: "bookings", icon: CalendarDays, phase: 6 },
      { label: "Chat", slug: "chat", icon: MessageSquare, phase: 8 },
      { label: "Settings", slug: "settings", icon: Settings, phase: 5 },
    ],
  },
  provider: {
    home: "/provider",
    items: [
      { label: "Offers", slug: "", icon: Inbox, phase: 7 },
      { label: "Jobs", slug: "jobs", icon: Briefcase, phase: 10 },
      { label: "Chat", slug: "chat", icon: MessageSquare, phase: 8 },
      { label: "Earnings", slug: "earnings", icon: Wallet, phase: 13 },
    ],
  },
  admin: {
    home: "/admin",
    items: [
      { label: "Needs action", slug: "", icon: BellRing, phase: 15 },
      { label: "Bookings", slug: "bookings", icon: CalendarDays, phase: 15 },
      { label: "Users", slug: "users", icon: Users, phase: 15 },
      { label: "Config", slug: "config", icon: SlidersHorizontal, phase: 15 },
      { label: "Chat", slug: "chat", icon: MessageSquare, phase: 15, overflow: true },
      { label: "Audit log", slug: "audit-log", icon: ClipboardList, phase: 15, overflow: true },
      { label: "Reports", slug: "reports", icon: ChartColumn, phase: 15, overflow: true },
    ],
  },
};

/** Admin phone tab that opens the list of overflow items (step 15.9). */
export const ADMIN_MORE = { label: "More", slug: "more", icon: Ellipsis } as const;

export function itemHref(role: Role, item: Pick<NavItem, "slug">): string {
  const home = NAV[role].home;
  return item.slug ? `${home}/${item.slug}` : home;
}

/** Look up a placeholder screen by its URL segment. Settings has its own page. */
export function findSection(role: Role, slug: string): NavItem | undefined {
  return NAV[role].items.find((i) => i.slug === slug && i.slug !== "settings");
}
