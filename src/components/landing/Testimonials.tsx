import { Star } from "lucide-react";

const reviews = [
  {
    name: "Awa Diallo",
    role: "Boutique de prêt-à-porter · Dakar",
    text: "Klika a transformé ma boutique WhatsApp. L'IA confirme les commandes toute seule, même la nuit. J'ai doublé mes ventes en 3 mois.",
    initials: "AD",
  },
  {
    name: "Mamadou Ba",
    role: "E-commerce électronique · Thiès",
    text: "Les paiements Wave et Orange Money intégrés directement dans les commandes, c'est un gain de temps énorme. Le meilleur outil du marché.",
    initials: "MB",
  },
  {
    name: "Fatou Sarr",
    role: "Cosmétiques naturels · Abidjan",
    text: "Le catalogue partageable et le QR code m'ont fait gagner des dizaines de clients. Interface magnifique et ultra rapide.",
    initials: "FS",
  },
];

export function Testimonials() {
  return (
    <section id="testimonials" className="bg-secondary/40 py-20 md:py-28">
      <div className="container-page">
        <div className="mx-auto max-w-2xl text-center">
          <span className="text-sm font-semibold uppercase tracking-wider text-primary">
            Avis clients
          </span>
          <h2 className="mt-3 text-3xl font-extrabold sm:text-4xl">
            Ils vendent plus avec Klika.sn
          </h2>
        </div>

        <div className="mt-14 grid gap-6 md:grid-cols-3">
          {reviews.map((r) => (
            <div key={r.name} className="rounded-2xl border bg-card p-6 shadow-soft">
              <div className="flex gap-1 text-primary">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Star key={i} className="h-4 w-4 fill-current" />
                ))}
              </div>
              <p className="mt-4 text-sm leading-relaxed">"{r.text}"</p>
              <div className="mt-6 flex items-center gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-primary to-primary-glow text-sm font-bold text-primary-foreground">
                  {r.initials}
                </span>
                <div>
                  <div className="text-sm font-semibold">{r.name}</div>
                  <div className="text-xs text-muted-foreground">{r.role}</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
