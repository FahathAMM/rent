"use client";

import { useEffect, useState } from "react";
import {
  MdAgriculture, MdAirportShuttle, MdDiamond, MdDirectionsBus, MdDirectionsCar, MdDirectionsCarFilled,
  MdElectricRickshaw, MdFavorite, MdKey, MdLocalShipping, MdLocalTaxi, MdMoped, MdPedalBike, MdRvHookup,
  MdTwoWheeler,
} from "react-icons/md";

/**
 * A vehicle category's `icon` is a react-icons component name (e.g. "MdDirectionsCarFilled").
 * These are the quick picks on /platform/categories and load instantly; any other name from a
 * set in ICON_SETS works too and loads that set on demand. `tone` is the home page tile colour.
 */
export const VEHICLE_TYPE_ICONS = [
  { name: "MdDirectionsCarFilled", label: "Car",        Icon: MdDirectionsCarFilled, tone: "blue",    alias: "car" },
  { name: "MdDirectionsCar",       label: "SUV / Jeep", Icon: MdDirectionsCar,       tone: "emerald", alias: "suv" },
  { name: "MdAirportShuttle",      label: "Van",        Icon: MdAirportShuttle,      tone: "violet",  alias: "van" },
  { name: "MdDirectionsBus",       label: "Bus",        Icon: MdDirectionsBus,       tone: "orange",  alias: "bus" },
  { name: "MdElectricRickshaw",    label: "Tuk-tuk",    Icon: MdElectricRickshaw,    tone: "amber",   alias: "tuktuk" },
  { name: "MdTwoWheeler",          label: "Motorbike",  Icon: MdTwoWheeler,          tone: "rose",    alias: "motorbike" },
  { name: "MdMoped",               label: "Scooter",    Icon: MdMoped,               tone: "sky",     alias: "scooter" },
  { name: "MdPedalBike",           label: "Bicycle",    Icon: MdPedalBike,           tone: "emerald", alias: "bicycle" },
  { name: "MdLocalShipping",       label: "Truck",      Icon: MdLocalShipping,       tone: "slate",   alias: "truck" },
  { name: "MdRvHookup",            label: "Camper",     Icon: MdRvHookup,            tone: "emerald", alias: "camper" },
  { name: "MdAgriculture",         label: "Tractor",    Icon: MdAgriculture,         tone: "amber",   alias: "tractor" },
  { name: "MdLocalTaxi",           label: "Taxi",       Icon: MdLocalTaxi,           tone: "amber",   alias: "taxi" },
  { name: "MdDiamond",             label: "Luxury",     Icon: MdDiamond,             tone: "violet",  alias: "luxury" },
  { name: "MdFavorite",            label: "Wedding",    Icon: MdFavorite,            tone: "rose",    alias: "wedding" },
  { name: "MdKey",                 label: "Self-drive", Icon: MdKey,                 tone: "sky",     alias: "selfdrive" },
];

const BUILT_IN = new Map(VEHICLE_TYPE_ICONS.flatMap((t) => [[t.name, t], [t.alias, t]]));

/** react-icons sets usable by name, keyed by the name prefix. Each is a separate chunk loaded only when used. */
export const ICON_SETS = {
  Md: { label: "Material", load: () => import("react-icons/md") },
  Fa: { label: "Font Awesome 6", load: () => import("react-icons/fa6") },
  Tb: { label: "Tabler", load: () => import("react-icons/tb") },
};
const SET_PREFIX = new RegExp(`^(${Object.keys(ICON_SETS).join("|")})(?=[A-Z0-9])`);

/** True when `name` looks like an icon from one of ICON_SETS (it may still not exist in the set). */
export function isIconName(name) {
  return typeof name === "string" && SET_PREFIX.test(name);
}

/**
 * Fallback when a category has no usable icon: the first keyword match on its name/slug/icon.
 * Order matters ("scooter" before "motorbike", "camper" before "van").
 */
const KEYWORD_RULES = [
  [/tuk|three[- ]?wheel|3[- ]?wheel|rickshaw/, "tuktuk"],
  [/scooter|moped|scooty/, "scooter"],
  [/motor ?bike|motorcycle|motor|bike/, "motorbike"],
  [/bicycle|cycle/, "bicycle"],
  [/camper|caravan|motorhome/, "camper"],
  [/bus|coach/, "bus"],
  [/van|mpv|people ?carrier/, "van"],
  [/suv|jeep|4x4|off[- ]?road|crossover/, "suv"],
  [/pickup|pick-up|lorry|truck|cargo/, "truck"],
  [/tractor/, "tractor"],
  [/cab|taxi/, "taxi"],
  [/luxury|premium|executive/, "luxury"],
  [/wedding/, "wedding"],
  [/self[- ]?drive/, "selfdrive"],
  [/car|sedan|hatch|saloon|economy|compact/, "car"],
];

/** The stored icon as a react-icons name: built-in aliases ("car") are expanded, anything unusable becomes "". */
export function normalizeIconName(icon) {
  if (BUILT_IN.has(icon)) return BUILT_IN.get(icon).name;
  return isIconName(icon) ? icon : "";
}

/** What a category shows: the icon it names, else a keyword guess. `auto` marks a guess; `tone` may be null. */
export function resolveCategoryIcon(category) {
  const stored = normalizeIconName(category?.icon);
  if (stored) return { name: stored, tone: BUILT_IN.get(stored)?.tone ?? null, auto: false };

  const haystack = [category?.name, category?.slug, category?.icon].filter(Boolean).join(" ").toLowerCase();
  const alias = KEYWORD_RULES.find(([re]) => re.test(haystack))?.[1];
  const type = alias && BUILT_IN.get(alias);
  return type ? { name: type.name, tone: type.tone, auto: true } : { name: "", tone: null, auto: true };
}

const loadedSets = {};

/**
 * The icon component for a react-icons name: built-ins at once, others after their set loads.
 * Returns undefined while loading, null when the name doesn't exist.
 */
export function useIconComponent(name) {
  const builtIn = BUILT_IN.get(name)?.Icon;
  const prefix = !builtIn && name?.match(SET_PREFIX)?.[1];
  const [, rerender] = useState(0);

  useEffect(() => {
    if (!prefix || loadedSets[prefix]) return;
    let live = true;
    ICON_SETS[prefix].load().then((mod) => { loadedSets[prefix] = mod; if (live) rerender((n) => n + 1); });
    return () => { live = false; };
  }, [prefix]);

  if (builtIn) return builtIn;
  if (!prefix) return null;
  const set = loadedSets[prefix];
  return set ? (set[name] ?? null) : undefined;
}

/** Renders a react-icons icon by name, with `fallback` while it loads or when the name is unknown. */
export function NamedIcon({ name, fallback: Fallback = MdDirectionsCarFilled, ...props }) {
  const Icon = useIconComponent(name);
  if (Icon) return <Icon {...props} />;
  return Fallback ? <Fallback {...props} /> : null;
}
