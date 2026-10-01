export const ITEMS_PER_PAGE = 21;
export const COLLECTIONS_PER_PAGE = 21;
export const DASHBOARD_COLLECTIONS_LIMIT = 6;
export const DASHBOARD_RECENT_ITEMS_LIMIT = 8;

export type PaginatedResult<T> = {
  items: T[];
  totalCount: number;
  page: number;
  pageSize: number;
  totalPages: number;
};

export function parsePageParam(value?: string): number {
  const page = Number(value);

  if (!Number.isInteger(page) || page < 1) {
    return 1;
  }

  return page;
}

export function getTotalPages(totalCount: number, pageSize: number): number {
  if (totalCount <= 0) {
    return 1;
  }

  return Math.ceil(totalCount / pageSize);
}

export function normalizePage(page: number, totalPages: number): number {
  return Math.min(Math.max(1, page), totalPages);
}

export function getVisiblePageNumbers(
  currentPage: number,
  totalPages: number,
): Array<number | "ellipsis"> {
  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, index) => index + 1);
  }

  const pages = new Set<number>([1, totalPages, currentPage]);

  if (currentPage > 1) {
    pages.add(currentPage - 1);
  }

  if (currentPage < totalPages) {
    pages.add(currentPage + 1);
  }

  if (currentPage <= 3) {
    pages.add(2);
    pages.add(3);
  }

  if (currentPage >= totalPages - 2) {
    pages.add(totalPages - 1);
    pages.add(totalPages - 2);
  }

  const sortedPages = [...pages].sort((left, right) => left - right);
  const visiblePages: Array<number | "ellipsis"> = [];

  for (const [index, pageNumber] of sortedPages.entries()) {
    const previousPage = sortedPages[index - 1];

    if (previousPage !== undefined && pageNumber - previousPage > 1) {
      visiblePages.push("ellipsis");
    }

    visiblePages.push(pageNumber);
  }

  return visiblePages;
}
