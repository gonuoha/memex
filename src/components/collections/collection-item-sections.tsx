import { ItemsListView } from "@/components/items/items-list-view";
import { SectionHeading } from "@/components/layout/page-container";
import type { CollectionItemType } from "@/lib/db/collections";
import type { DashboardItem, FileListItem } from "@/lib/db/items";
import { getItemTypeLabel, sortItemTypesBySystemOrder } from "@/lib/item-type-styles";
import type { ItemsView } from "@/lib/user-preferences";

type CollectionItemSectionsProps = {
  items: DashboardItem[];
  fileItems: FileListItem[];
  view: ItemsView;
};

type ItemTypeGroup = {
  type: CollectionItemType;
  items: DashboardItem[];
};

function groupItemsByType(items: DashboardItem[]): ItemTypeGroup[] {
  const groups = new Map<string, ItemTypeGroup>();

  for (const item of items) {
    const key = item.type.name.toLowerCase();
    const existing = groups.get(key);

    if (existing) {
      existing.items.push(item);
    } else {
      groups.set(key, { type: item.type, items: [item] });
    }
  }

  return sortItemTypesBySystemOrder(
    [...groups.values()].map((group) => ({ ...group, name: group.type.name })),
  ).map(({ type, items: groupItems }) => ({ type, items: groupItems }));
}

function renderTypeSection(
  group: ItemTypeGroup,
  fileItems: FileListItem[],
  view: ItemsView,
) {
  const typeName = group.type.name.toLowerCase();

  return (
    <ItemsListView
      items={group.items}
      view={view}
      typeName={typeName}
      fileItems={fileItems}
    />
  );
}

export function CollectionItemSections({
  items,
  fileItems,
  view,
}: CollectionItemSectionsProps) {
  const groups = groupItemsByType(items);

  return (
    <div className="flex flex-col gap-8">
      {groups.map((group) => (
        <section key={group.type.id}>
          <SectionHeading>
            {getItemTypeLabel(group.type.name, {
              plural: true,
              isSystem: group.type.isSystem ?? true,
            })}
          </SectionHeading>
          {renderTypeSection(group, fileItems, view)}
        </section>
      ))}
    </div>
  );
}
