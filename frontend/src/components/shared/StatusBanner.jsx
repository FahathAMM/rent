/** A tinted icon+text banner for status messages (info/success/warning/destructive) — used wherever a plain bordered Card previously carried this. */
export function StatusBanner({ icon: Icon, tone = "info", title, body, action }) {
  const tones = {
    info: "bg-muted/60 text-foreground [&_svg]:text-muted-foreground",
    success: "bg-emerald-50 text-emerald-800 [&_svg]:text-emerald-600",
    warning: "bg-amber-50 text-amber-800 [&_svg]:text-amber-600",
    destructive: "bg-destructive/10 text-destructive [&_svg]:text-destructive",
  };
  return (
    <div className={`flex items-start gap-3 rounded-2xl p-4 ${tones[tone]}`}>
      <Icon className="mt-0.5 h-5 w-5 shrink-0" />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold">{title}</p>
        {body && <p className="mt-0.5 text-sm opacity-90">{body}</p>}
      </div>
      {action}
    </div>
  );
}
