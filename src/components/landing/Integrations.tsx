const integrations = [
  "Wave",
  "Orange Money",
  "Free Money",
  "PayDunya",
  "Stripe",
  "WhatsApp",
  "Instagram",
  "Facebook",
  "TikTok",
];

export function Integrations() {
  return (
    <section className="border-y bg-secondary/40 py-14">
      <div className="container-page text-center">
        <p className="text-sm font-medium text-muted-foreground">
          Connecté aux outils que vos clients utilisent déjà
        </p>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-x-10 gap-y-4">
          {integrations.map((name) => (
            <span
              key={name}
              className="text-lg font-bold text-muted-foreground/70 transition-colors hover:text-foreground"
            >
              {name}
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}
