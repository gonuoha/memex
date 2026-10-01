import { revalidatePath } from "next/cache";

export function revalidateAppAfterItemMutation(): void {
  revalidatePath("/", "layout");
}
