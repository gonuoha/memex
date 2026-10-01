import { FileList } from "@/components/items/file-list";
import { ImageGalleryGrid } from "@/components/items/image-thumbnail-card";
import { ItemRow } from "@/components/dashboard/item-row";
import { ItemsGrid } from "@/components/items/item-card";
import type { DashboardItem, FileListItem } from "@/lib/db/items";
import type { ItemsView } from "@/lib/user-preferences";

type ItemsListViewProps = {
  items: DashboardItem[];
  view: ItemsView;
  typeName: string;
  fileItems?: FileListItem[];
};

export function ItemsListView({
  items,
  view,
  typeName,
  fileItems = [],
}: ItemsListViewProps) {
  const normalizedType = typeName.toLowerCase();

  if (normalizedType === "file") {
    return <FileList items={fileItems} />;
  }

  if (normalizedType === "image") {
    return <ImageGalleryGrid items={items} />;
  }

  if (view === "list") {
    return (
      <div className="space-y-2">
        {items.map((item) => (
          <ItemRow key={item.id} item={item} />
        ))}
      </div>
    );
  }

  return <ItemsGrid items={items} />;
}
