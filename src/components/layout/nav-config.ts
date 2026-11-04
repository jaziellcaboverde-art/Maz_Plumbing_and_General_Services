import {
  BookOpenCheck,
  Briefcase,
  CalendarDays,
  ChartColumn,
  ClipboardCheck,
  ClipboardList,
  Ellipsis,
  FileText,
  History,
  House,
  Inbox,
  LayoutDashboard,
  MessageSquare,
  ListTodo,
  SlidersHorizontal,
  Star,
  UserCheck,
  Users,
  Wallet,
  Wrench,
  type LucideIcon,
} from "lucide-react";
import { ROLES, type Role } from "@/lib/auth/roles";

export { ROLES, type Role };

export type NavItem = {
  label: string;
  slug: string;
  icon: LucideIcon;
  phase: number;
  /** Optional desktop section heading, used to organize long admin menus. */
  group?: string;
  /** Kept in the desktop sidebar but placed behind More on narrow screens. */
  overflow?: boolean;
};

export type RoleNavConfig = { home: string; items: readonly NavItem[] };

/**
 * Navigation follows the revised KumpuNinja information architecture.
 * The four most frequent actions remain visible as phone tabs; supporting tools
 * stay visible in the desktop sidebar and move behind More on small screens.
 */
export const NAV: Record<Role, RoleNavConfig> = {
  customer: {
    home: "/customer",
    items: [
      { label: "Dashboard", slug: "", icon: House, phase: 6 },
      {
        label: "Book a Service",
        slug: "bookings/new",
        icon: ClipboardCheck,
        phase: 6,
      },
      { label: "My bookings", slug: "bookings", icon: CalendarDays, phase: 6 },
      {
        label: "Service History",
        slug: "bookings/history",
        icon: History,
        phase: 10,
      },
      {
        label: "Services",
        slug: "services",
        icon: Wrench,
        phase: 6,
        overflow: true,
      },
      {
        label: "My projects",
        slug: "projects",
        icon: Briefcase,
        phase: 10,
        overflow: true,
      },
      {
        label: "Payments",
        slug: "payments",
        icon: Wallet,
        phase: 10,
        overflow: true,
      },
      {
        label: "Messages",
        slug: "chat",
        icon: MessageSquare,
        phase: 8,
        overflow: true,
      },
      {
        label: "My reviews",
        slug: "reviews",
        icon: Star,
        phase: 10,
        overflow: true,
      },
    ],
  },
  provider: {
    home: "/provider",
    items: [
      { label: "Dashboard", slug: "", icon: LayoutDashboard, phase: 7 },
      { label: "Offers", slug: "offers", icon: ClipboardList, phase: 10 },
      { label: "Assignments", slug: "jobs", icon: Inbox, phase: 10 },
      { label: "Schedule", slug: "schedule", icon: CalendarDays, phase: 10 },
      {
        label: "Earnings",
        slug: "earnings",
        icon: Wallet,
        phase: 13,
        overflow: true,
      },
      {
        label: "Messages",
        slug: "chat",
        icon: MessageSquare,
        phase: 8,
        overflow: true,
      },
    ],
  },
  admin: {
    home: "/admin",
    items: [
      {
        label: "Dashboard",
        slug: "",
        icon: LayoutDashboard,
        phase: 15,
        group: "Overview",
      },
      {
        label: "Bookings",
        slug: "bookings",
        icon: CalendarDays,
        phase: 15,
        group: "Operations",
      },
      {
        label: "Assignments",
        slug: "assignments",
        icon: UserCheck,
        phase: 7,
        group: "Operations",
      },
      {
        label: "Create booking",
        slug: "create-booking",
        icon: ClipboardCheck,
        phase: 15,
        group: "Operations",
      },
      {
        label: "Provider work",
        slug: "provider-work-updates",
        icon: ClipboardCheck,
        phase: 10,
        overflow: true,
        group: "Operations",
      },
      {
        label: "Provider schedules",
        slug: "provider-schedules",
        icon: CalendarDays,
        phase: 15,
        overflow: true,
        group: "Operations",
      },
      {
        label: "Quotes & contracts",
        slug: "quotes",
        icon: FileText,
        phase: 15,
        overflow: true,
        group: "Operations",
      },
      {
        label: "Payments",
        slug: "payments",
        icon: Wallet,
        phase: 15,
        overflow: true,
        group: "Operations",
      },
      {
        label: "Providers",
        slug: "users",
        icon: Users,
        phase: 15,
        overflow: true,
        group: "People & services",
      },
      {
        label: "Customers",
        slug: "customers",
        icon: Users,
        phase: 15,
        overflow: true,
        group: "People & services",
      },
      {
        label: "Provider applications",
        slug: "provider-applications",
        icon: ListTodo,
        phase: 5,
        overflow: true,
        group: "People & services",
      },
      {
        label: "Services",
        slug: "services",
        icon: Wrench,
        phase: 6,
        overflow: true,
        group: "People & services",
      },
      {
        label: "Portfolio",
        slug: "portfolio",
        icon: BookOpenCheck,
        phase: 15,
        overflow: true,
        group: "People & services",
      },
      {
        label: "Reports",
        slug: "reports",
        icon: ChartColumn,
        phase: 15,
        overflow: true,
        group: "Insights & system",
      },
      {
        label: "Audit log",
        slug: "audit-log",
        icon: ClipboardList,
        phase: 15,
        overflow: true,
        group: "Insights & system",
      },
      {
        label: "Configuration",
        slug: "config",
        icon: SlidersHorizontal,
        phase: 15,
        overflow: true,
        group: "Insights & system",
      },
    ],
  },
};

export const ADMIN_MORE = {
  label: "More",
  slug: "more",
  icon: Ellipsis,
} as const;

export type NavSubmenu = {
  id: string;
  label: string;
  icon: LucideIcon;
  slugs: readonly string[];
  labels?: Record<string, string>;
};
export const NAV_SUBMENUS: Record<Role, readonly NavSubmenu[]> = {
  admin: [
    {
      id: "bookings",
      label: "Bookings",
      icon: CalendarDays,
      slugs: ["bookings", "assignments", "create-booking"],
      labels: { bookings: "All bookings" },
    },
    {
      id: "provider-work",
      label: "Provider work",
      icon: Briefcase,
      slugs: ["provider-work-updates", "provider-schedules"],
      labels: {
        "provider-work-updates": "Work updates",
        "provider-schedules": "Schedules",
      },
    },
    {
      id: "providers",
      label: "Providers",
      icon: Users,
      slugs: ["users", "provider-applications"],
      labels: {
        users: "Provider directory",
        "provider-applications": "Applications",
      },
    },
  ],
  customer: [
    {
      id: "bookings",
      label: "Bookings",
      icon: CalendarDays,
      slugs: ["bookings", "bookings/history"],
    },
  ],
  provider: [
    {
      id: "work",
      label: "My work",
      icon: Briefcase,
      slugs: ["offers", "jobs"],
    },
  ],
};

export function navEntries(
  role: Role,
): { item: NavItem; menu: NavSubmenu | null; children: NavItem[] }[] {
  const seen = new Set<string>();
  return NAV[role].items.flatMap<{
    item: NavItem;
    menu: NavSubmenu | null;
    children: NavItem[];
  }>((item) => {
    const menu = NAV_SUBMENUS[role].find((group) =>
      group.slugs.includes(item.slug),
    );
    if (!menu) return [{ item, menu: null, children: [] as NavItem[] }];
    if (seen.has(menu.id)) return [];
    seen.add(menu.id);
    return [
      {
        item,
        menu,
        children: NAV[role].items.filter((child) =>
          menu.slugs.includes(child.slug),
        ),
      },
    ];
  });
}

export function itemHref(role: Role, item: Pick<NavItem, "slug">): string {
  const home = NAV[role].home;
  return item.slug ? `${home}/${item.slug}` : home;
}

export function findSection(role: Role, slug: string): NavItem | undefined {
  return NAV[role].items.find((i) => i.slug === slug && i.slug !== "settings");
}
