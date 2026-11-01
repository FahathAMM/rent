// Colour per plan — the same bands the platform's Plans tab uses. Unknown codes cycle through the extras.
const ACCENTS = {
  basic: { band: "bg-gradient-to-br from-slate-500/10 to-transparent", icon: "text-slate-500", ring: "ring-slate-400" },
  none: { band: "bg-gradient-to-br from-amber-500/15 to-transparent", icon: "text-amber-600", ring: "ring-amber-500" },
  pro: { band: "bg-gradient-to-br from-indigo-500/15 via-violet-500/10 to-transparent", icon: "text-indigo-600", ring: "ring-indigo-500" },
  business: { band: "bg-gradient-to-br from-amber-500/20 via-orange-500/10 to-transparent", icon: "text-amber-600", ring: "ring-amber-500" },
};
const EXTRA = [
  { band: "bg-gradient-to-br from-emerald-500/15 to-transparent", icon: "text-emerald-600", ring: "ring-emerald-500" },
  { band: "bg-gradient-to-br from-sky-500/15 to-transparent", icon: "text-sky-600", ring: "ring-sky-500" },
  { band: "bg-gradient-to-br from-pink-500/15 to-transparent", icon: "text-pink-600", ring: "ring-pink-500" },
];

export const planAccent = (code, index = 0) => ACCENTS[code] ?? EXTRA[index % EXTRA.length];

export const periodLabel = (days) => (days === 30 ? "month" : days === 365 ? "year" : `${days} days`);
