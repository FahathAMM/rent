import { Egg, Package, Beef, Fish, Milk, Wheat, Snowflake } from "lucide-react";

// Lucide's outline meat icons (Drumstick/Ham) collapse into an unreadable
// squiggle at small badge sizes. This is Material Design Icons' "food
// drumstick" glyph (mdi:food-drumstick) — its bitten-meat-lobe-plus-bone
// silhouette was verified side by side against several alternatives and is
// the only one that still reads as a drumstick down to 14-16px.
function ChickenLegIcon({ className }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
      <path d="M20.16 12.73A6.27 6.27 0 0 0 19.09 3c-2.01-1.33-4.7-1.34-6.73-.03c-1.76 1.13-2.73 2.89-2.9 4.71c-.13 1.32-.63 2.55-1.55 3.47l-.03.03c-1.16 1.16-1.16 2.93-.07 4.01l.99.99a2.794 2.794 0 0 0 3.95 0c.97-.97 2.25-1.5 3.64-1.65c1.37-.15 2.71-.75 3.77-1.8m-13.9 7.13c.27.56.18 1.24-.29 1.7a1.49 1.49 0 0 1-2.55-.98a1.49 1.49 0 0 1-.98-2.55c.46-.46 1.15-.56 1.7-.29l2.48-2.43c.14.19.3.41.48.59l.99.99c.21.2.41.37.67.52z" />
    </svg>
  );
}

// Health Icons' "animal-chicken" glyph — a standing bird silhouette, same
// small-UI design goal as the drumstick above, for live/whole-bird items
// (as opposed to cut meat, which uses the drumstick icon).
function LiveChickenIcon({ className }) {
  return (
    <svg viewBox="0 0 48 48" fill="currentColor" className={className}>
      <path fillRule="evenodd" d="M18.5 7.414c0-1.782-2.154-2.674-3.414-1.414L6.5 14.586C5.24 15.846 6.132 18 7.914 18h3.469a8.3 8.3 0 0 1-.277 2.4l-.761 2.842c-.882 3.293-1.135 6.912.75 9.753A15.7 15.7 0 0 0 24 40v2h-5v2h9.5v-2H26v-2.101a15.7 15.7 0 0 0 8.733-3.924A13.9 13.9 0 0 1 29.478 37C22.071 37 16 31.216 16 24a1 1 0 0 1 2 0c0 6.039 5.102 11 11.478 11c3.525 0 6.67-1.521 8.772-3.905q.099-.112.22-.187c.5-1.09.877-2.248 1.113-3.455c.369-1.892.914-3.784 2.078-5.32c.483-.637-.06-1.536-.848-1.406L27.698 22.89a5 5 0 0 1-5.2-2.533l-3.32-6.067l2.02-1.795C22.574 11.273 21.709 9 19.87 9H18.5zm-.307 5.076L19.87 11H18.5a2 2 0 0 1-2-2V7.414l-2.644 2.644q.329-.058.675-.058a3.88 3.88 0 0 1 3.403 2.017zm-7.485.716L7.914 16h3.159l-.298-1.148a3.9 3.9 0 0 1-.067-1.646M14 14a1 1 0 1 0 0-2a1 1 0 0 0 0 2" clipRule="evenodd" />
    </svg>
  );
}

// The curated, chicken-shop-relevant icon set an item can be tagged with —
// kept deliberately small and product-specific (unlike the generic
// lib/iconMap used for nav menus). Backend validates `icon` against these
// same keys (StoreItemRequest/UpdateItemRequest), so keep both in sync.
export const ITEM_ICONS = [
  { value: "drumstick", label: "Chicken / Meat", icon: ChickenLegIcon },
  { value: "chicken", label: "Live Chicken", icon: LiveChickenIcon },
  { value: "egg", label: "Eggs", icon: Egg },
  { value: "package", label: "Supplies", icon: Package },
  { value: "snowflake", label: "Ice / Cold", icon: Snowflake },
  { value: "wheat", label: "Feed", icon: Wheat },
  { value: "fish", label: "Fish", icon: Fish },
  { value: "beef", label: "Other Meat", icon: Beef },
  { value: "milk", label: "Dairy", icon: Milk },
];

export function getItemIcon(key) {
  return ITEM_ICONS.find((i) => i.value === key)?.icon ?? null;
}
