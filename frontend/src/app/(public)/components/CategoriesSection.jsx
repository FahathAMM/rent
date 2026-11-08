import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { SectionHeader } from "@/components/public/SectionHeader";
import { NamedIcon, resolveCategoryIcon } from "@/lib/vehicleTypeIcons";

const MAX_TILES = 12;

/** Icon-chip and hover colours per tone. Full class names so Tailwind keeps them in the build. */
const TONES = {
  blue:    "bg-blue-50 text-blue-600 dark:bg-blue-500/15 dark:text-blue-300",
  emerald: "bg-emerald-50 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-300",
  violet:  "bg-violet-50 text-violet-600 dark:bg-violet-500/15 dark:text-violet-300",
  orange:  "bg-orange-50 text-orange-600 dark:bg-orange-500/15 dark:text-orange-300",
  rose:    "bg-rose-50 text-rose-600 dark:bg-rose-500/15 dark:text-rose-300",
  sky:     "bg-sky-50 text-sky-600 dark:bg-sky-500/15 dark:text-sky-300",
  amber:   "bg-amber-50 text-amber-600 dark:bg-amber-500/15 dark:text-amber-300",
  slate:   "bg-slate-100 text-slate-700 dark:bg-slate-500/20 dark:text-slate-200",
};
const FALLBACK_TONES = ["blue", "emerald", "violet", "orange", "rose", "sky"];

function CategoryTile({ category, index }) {
  const count = category.vehicles_count;
  const { name: iconName, tone: toneKey } = resolveCategoryIcon(category);
  const tone = TONES[toneKey ?? FALLBACK_TONES[index % FALLBACK_TONES.length]];

  return (
    <Link
      href={`/rent?category_id=${category.id}`}
      className="group flex items-center gap-2.5 rounded-xl border bg-card p-2.5 sm:gap-3 sm:pr-3 transition-all duration-200 hover:border-primary/40 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
    >
      <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${tone}`}>
        <NamedIcon name={iconName} className="h-6 w-6 transition-transform duration-200 group-hover:scale-110" aria-hidden="true" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="line-clamp-2 break-words text-[13px] font-semibold leading-tight text-foreground sm:text-sm">{category.name}</span>
        {count != null && (
          <span className="mt-0.5 block truncate text-xs text-muted-foreground">
            {count ? `${count} ${count === 1 ? "vehicle" : "vehicles"}` : "Coming soon"}
          </span>
        )}
      </span>
      <ChevronRight className="hidden h-4 w-4 shrink-0 text-muted-foreground/60 sm:block transition-transform duration-200 group-hover:translate-x-0.5 group-hover:text-primary" aria-hidden="true" />
    </Link>
  );
}

/** "Browse by vehicle type": the types with the most vehicles for rent. Ties keep the platform's sort order. */
export function CategoriesSection({ categories }) {
  const tiles = [...categories]
    .sort((a, b) => (b.vehicles_count ?? 0) - (a.vehicles_count ?? 0))
    .slice(0, MAX_TILES);

  return (
    <section className="mx-auto max-w-6xl px-4 py-6 sm:py-8">
      <SectionHeader eyebrow="Find your ride" title="Browse by vehicle type" highlight="vehicle type" subtitle="From city cars to vans for the whole family." href="/rent" linkLabel="Browse all" />
      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-4">
        {tiles.map((category, i) => <CategoryTile key={category.id} category={category} index={i} />)}
      </div>
    </section>
  );
}
