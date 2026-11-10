/** The banner shared by the Help & Support pages (stay safe, FAQ, contact, terms, privacy). */
export function HelpPageHero({ title, description }) {
  return (
    <section className="relative isolate overflow-hidden border-b">
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="aurora-blob aurora-blob-2" />
        <div className="aurora-grain" />
      </div>
      <div className="relative mx-auto max-w-6xl px-4 py-16 text-center">
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">{title}</h1>
        <p className="mx-auto mt-3 max-w-lg text-muted-foreground">{description}</p>
      </div>
    </section>
  );
}
