import { LayoutDashboard, Star, Trash2 } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { SidebarData } from "@/lib/db/sidebar";
import { getItemTypeIcon, getItemTypeLabel, getItemTypeStyles } from "@/lib/item-type-styles";
import { cn } from "@/lib/utils";

import { SidebarCollapseButton } from "./sidebar-collapse-button";
import { SidebarNavLink } from "./sidebar-link";
import { SidebarSection } from "./sidebar-section";
import { SidebarUserMenu } from "./sidebar-user-menu";

function getTypeSlug(name: string) {
  return name.toLowerCase();
}

const PRO_ITEM_TYPES = new Set(["file", "image"]);

function isProItemType(name: string) {
  return PRO_ITEM_TYPES.has(name.toLowerCase());
}

type SidebarContentProps = {
  sidebarData: SidebarData;
};

export function SidebarContent({ sidebarData }: SidebarContentProps) {
  const { user, itemTypes, favoriteCollections, recentCollections, itemCounts } =
    sidebarData;

  const navItems = [
    {
      href: "/dashboard",
      label: "Dashboard",
      icon: LayoutDashboard,
    },
    {
      href: "/favorites",
      label: "Favorites",
      icon: Star,
      count: itemCounts.favoriteCount,
    },
    {
      href: "/trash",
      label: "Trash",
      icon: Trash2,
      count: itemCounts.trashCount,
    },
  ];

  return (
    <div className="flex h-full min-h-0 flex-col bg-sidebar text-sidebar-foreground">
      <div className="sidebar-header group-data-[collapsed]:justify-center group-data-[collapsed]:px-2 flex shrink-0 items-center justify-between p-3">
        <span className="sidebar-text group-data-[collapsed]:hidden px-2 text-sm font-medium">
          Navigation
        </span>
        <SidebarCollapseButton />
      </div>

      <ScrollArea className="min-h-0 flex-1 px-2">
        <div className="space-y-3 pb-4">
          <nav className="space-y-0.5">
            {navItems.map((item) => {
              const Icon = item.icon;
              return (
                <SidebarNavLink
                  key={item.href}
                  href={item.href}
                  title={item.label}
                  className="group-data-[collapsed]:justify-center group-data-[collapsed]:px-0"
                >
                  <Icon className="size-4 shrink-0" />
                  <span className="sidebar-text group-data-[collapsed]:hidden flex-1 truncate">{item.label}</span>
                  {"count" in item && item.count != null ? (
                    <span className="sidebar-text group-data-[collapsed]:hidden text-xs text-muted-foreground">
                      {item.count}
                    </span>
                  ) : null}
                </SidebarNavLink>
              );
            })}
          </nav>

          <SidebarSection title="Item Types" className="sidebar-section">
            <nav className="space-y-0.5 px-1">
              {itemTypes.map((type) => {
                const Icon = getItemTypeIcon(type.icon);
                const styles = getItemTypeStyles(type.color);
                const isProType = isProItemType(type.name);
                const href =
                  isProType && !user.isPro
                    ? "/upgrade"
                    : `/items/${getTypeSlug(type.name)}`;

                return (
                  <SidebarNavLink
                    key={type.id}
                    href={href}
                    match={isProType && !user.isPro ? "exact" : "prefix"}
                    title={getItemTypeLabel(type.name, { plural: true })}
                    activeIndicatorStyle={
                      type.color?.startsWith("#")
                        ? { borderLeftColor: type.color }
                        : undefined
                    }
                  >
                    <Icon
                      className={cn("size-3.5 shrink-0", styles.textClassName)}
                      style={styles.textStyle}
                    />
                    <div className="flex min-w-0 flex-1 items-center gap-1.5">
                      <span className="truncate">
                        {getItemTypeLabel(type.name, { plural: true })}
                      </span>
                      {isProType && !user.isPro ? (
                        <Badge
                          variant="outline"
                          className="h-4 shrink-0 border-border/60 px-1 text-[10px] font-medium uppercase tracking-wide text-muted-foreground"
                        >
                          PRO
                        </Badge>
                      ) : null}
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {type.itemCount}
                    </span>
                  </SidebarNavLink>
                );
              })}
            </nav>
          </SidebarSection>

          <SidebarSection title="Collections" className="sidebar-section">
            <div className="space-y-2">
              {favoriteCollections.length > 0 ? (
                <div className="space-y-0.5">
                  <p className="px-2 text-xs font-medium text-muted-foreground">
                    Favorites
                  </p>
                  <nav className="space-y-0.5">
                    {favoriteCollections.map((collection) => (
                      <SidebarNavLink
                        key={collection.id}
                        href={`/collections/${collection.id}`}
                        title={collection.name}
                      >
                        <Star className="size-4 shrink-0 fill-favorite text-favorite" />
                        <span className="flex-1 truncate">{collection.name}</span>
                        <span className="text-xs text-muted-foreground">
                          {collection.itemCount}
                        </span>
                      </SidebarNavLink>
                    ))}
                  </nav>
                </div>
              ) : null}

              {recentCollections.length > 0 ? (
                <div className="space-y-0.5">
                  <p className="px-2 text-xs font-medium text-muted-foreground">
                    Recent
                  </p>
                  <nav className="space-y-0.5">
                    {recentCollections.map((collection) => (
                      <SidebarNavLink
                        key={collection.id}
                        href={`/collections/${collection.id}`}
                        title={collection.name}
                      >
                        <span
                          className="size-2.5 shrink-0 rounded-full bg-muted-foreground"
                          style={
                            collection.dominantTypeColor
                              ? { backgroundColor: collection.dominantTypeColor }
                              : undefined
                          }
                        />
                        <span className="flex-1 truncate">{collection.name}</span>
                        <span className="text-xs text-muted-foreground">
                          {collection.itemCount}
                        </span>
                      </SidebarNavLink>
                    ))}
                  </nav>
                </div>
              ) : null}

              <SidebarNavLink
                href="/collections"
                className="px-2 text-xs text-muted-foreground"
              >
                View all collections
              </SidebarNavLink>
            </div>
          </SidebarSection>
        </div>
      </ScrollArea>

      <div className="sidebar-footer group-data-[collapsed]:flex group-data-[collapsed]:justify-center group-data-[collapsed]:px-2 shrink-0 border-t border-sidebar-border p-3">
        <SidebarUserMenu user={user} />
      </div>
    </div>
  );
}
