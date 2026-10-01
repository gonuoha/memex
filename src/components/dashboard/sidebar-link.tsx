"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ComponentProps, CSSProperties } from "react";

import { cn } from "@/lib/utils";

import { useSidebar } from "./sidebar-context";

type SidebarLinkProps = ComponentProps<typeof Link>;

export function SidebarLink({ onClick, className, ...props }: SidebarLinkProps) {
  const { isMobile, setMobileOpen } = useSidebar();

  return (
    <Link
      {...props}
      className={cn(
        "outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
        className,
      )}
      onClick={(event) => {
        onClick?.(event);

        if (isMobile) {
          setMobileOpen(false);
        }
      }}
    />
  );
}

type SidebarNavMatch = "exact" | "prefix";

function isPathActive(pathname: string, href: string, match: SidebarNavMatch) {
  if (match === "exact") {
    return pathname === href;
  }

  return pathname === href || pathname.startsWith(`${href}/`);
}

type SidebarNavLinkProps = SidebarLinkProps & {
  active?: boolean;
  match?: SidebarNavMatch;
  activeClassName?: string;
  activeIndicatorStyle?: CSSProperties;
};

export function SidebarNavLink({
  active,
  match = "exact",
  activeClassName,
  activeIndicatorStyle,
  className,
  children,
  href,
  style,
  ...props
}: SidebarNavLinkProps) {
  const pathname = usePathname();
  const isActive =
    active ??
    (typeof href === "string" && isPathActive(pathname, href, match));

  return (
    <SidebarLink
      {...props}
      href={href}
      aria-current={isActive ? "page" : undefined}
      className={cn(
        "sidebar-nav-link flex h-8 min-h-8 items-center gap-2 rounded-md border-l-2 px-2 text-sm transition-colors",
        className,
        isActive
          ? cn(
              "border-sidebar-primary bg-sidebar-accent font-medium text-sidebar-accent-foreground",
              activeClassName,
            )
          : "border-transparent hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
      )}
      style={isActive ? { ...style, ...activeIndicatorStyle } : style}
    >
      {children}
    </SidebarLink>
  );
}
