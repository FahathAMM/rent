import { useCallback } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";

export function useTableParams({ defaultPerPage = 15 } = {}) {
  const router       = useRouter();
  const pathname     = usePathname();
  const searchParams = useSearchParams();

  const search  = searchParams.get("search")   ?? "";
  const page    = Number(searchParams.get("page")     ?? 1);
  const perPage = Number(searchParams.get("per_page") ?? defaultPerPage);
  const sortKey = searchParams.get("sort") ?? "";
  const sortDir = searchParams.get("dir")  ?? "asc";

  const commit = useCallback(
    (updates) => {
      const p = new URLSearchParams(searchParams.toString());
      for (const [k, v] of Object.entries(updates)) {
        if (v === null || v === undefined || v === "") {
          p.delete(k);
        } else {
          p.set(k, String(v));
        }
      }
      if (p.get("page") === "1") p.delete("page");
      router.replace(`${pathname}?${p.toString()}`, { scroll: false });
    },
    [router, pathname, searchParams],
  );

  // Debounce for search is handled inside TableToolbar; this just commits to URL
  const setSearch  = useCallback((v) => commit({ search: v || null, page: null }), [commit]);
  const setPage    = useCallback((v) => commit({ page: v }), [commit]);
  const setPerPage = useCallback(
    (v) => commit({ per_page: Number(v) !== defaultPerPage ? v : null, page: null }),
    [commit, defaultPerPage],
  );
  const toggleSort = useCallback(
    (key) => {
      const newDir = sortKey === key ? (sortDir === "asc" ? "desc" : "asc") : "asc";
      commit({ sort: key, dir: newDir, page: null });
    },
    [commit, sortKey, sortDir],
  );

  return { search, page, perPage, sortKey, sortDir, setSearch, setPage, setPerPage, toggleSort };
}
