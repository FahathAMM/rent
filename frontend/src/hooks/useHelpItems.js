import { useQuery } from "@tanstack/react-query";
import { publicService } from "@/services/publicService";

/** The Stay safe, FAQ, Terms & Conditions and Privacy Policy content from Help & Support in the platform admin. */
export function useHelpItems() {
  return useQuery({
    queryKey: ["public-help-items"],
    queryFn: () => publicService.helpItems().then((r) => r.data.data),
    staleTime: 60_000,
  });
}

/** Ordered items -> [{ name, items }], with sections in the order they first appear. */
export function groupBySection(items) {
  const sections = new Map();
  items.forEach((item) => {
    const name = item.section ?? "";
    if (!sections.has(name)) sections.set(name, []);
    sections.get(name).push(item);
  });
  return [...sections].map(([name, sectionItems]) => ({ name, items: sectionItems }));
}
