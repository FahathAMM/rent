/**
 * The banner at the top of every account list page — the same soft aurora
 * wash as the dashboard's welcome hero (lighter), so each page opens with
 * some colour instead of a bare title on white. `children` renders a row
 * under the title (e.g. summary stats).
 */
export function AccountPageHeader({ icon: Icon, title, description, action, children }) {
  return (
    <div className="relative isolate overflow-hidden rounded-2xl border bg-card p-4 shadow-sm sm:p-5">
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden opacity-50">
        <div className="aurora-blob aurora-blob-1" />
        <div className="aurora-blob aurora-blob-3" />
      </div>
      <div className="relative flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-orange-500 via-pink-500 to-violet-500 text-white shadow-sm">
            <Icon className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-xl font-semibold tracking-tight">{title}</h1>
            {description && <p className="text-sm text-muted-foreground">{description}</p>}
          </div>
        </div>
        {action && <div className="shrink-0">{action}</div>}
      </div>
      {children && <div className="relative mt-4">{children}</div>}
    </div>
  );
}
