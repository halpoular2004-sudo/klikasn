import { useState } from "react";
import { Check, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";

const plans = [
  {
    name: "Starter",
    monthly: 0,
    yearly: 0,
    tagline: "Pour démarrer",
    features: [
      "1 utilisateur",
      "Jusqu'à 50 commandes/mois",
      "Catalogue partageable",
      "WhatsApp manuel",
    ],
    cta: "Commencer gratuitement",
    highlight: false,
  },
  {
    name: "Pro",
    monthly: 15000,
    yearly: 150000,
    tagline: "Le plus populaire",
    features: [
      "5 utilisateurs",
      "Commandes illimitées",
      "Assistant IA (FR & Wolof)",
      "Automatisations & relances",
      "Paiements Wave / Orange Money",
    ],
    cta: "Essayer 14 jours",
    highlight: true,
  },
  {
    name: "Business",
    monthly: 35000,
    yearly: 350000,
    tagline: "Pour les équipes",
    features: [
      "Utilisateurs illimités",
      "Module livraison & livreurs",
      "Analytics avancées",
      "Campagnes marketing",
      "Support prioritaire",
    ],
    cta: "Essayer 14 jours",
    highlight: false,
  },
  {
    name: "Enterprise",
    monthly: null,
    yearly: null,
    tagline: "Sur mesure",
    features: [
      "Volume & SLA dédiés",
      "Intégrations personnalisées",
      "Accompagnement dédié",
      "Sécurité renforcée",
    ],
    cta: "Nous contacter",
    highlight: false,
  },
];

function formatPrice(v: number) {
  return new Intl.NumberFormat("fr-FR").format(v);
}

export function Pricing() {
  const [yearly, setYearly] = useState(false);

  return (
    <section id="pricing" className="py-20 md:py-28">
      <div className="container-page">
        <div className="mx-auto max-w-2xl text-center">
          <span className="text-sm font-semibold uppercase tracking-wider text-primary">
            Tarifs
          </span>
          <h2 className="mt-3 text-3xl font-extrabold sm:text-4xl">
            Des prix simples et transparents
          </h2>
          <p className="mt-4 text-muted-foreground">
            Sans engagement. Changez ou annulez à tout moment.
          </p>

          <div className="mt-8 inline-flex items-center gap-3 rounded-full border bg-card p-1 text-sm font-medium shadow-soft">
            <button
              onClick={() => setYearly(false)}
              className={`rounded-full px-4 py-1.5 transition-colors ${
                !yearly ? "bg-primary text-primary-foreground" : "text-muted-foreground"
              }`}
            >
              Mensuel
            </button>
            <button
              onClick={() => setYearly(true)}
              className={`rounded-full px-4 py-1.5 transition-colors ${
                yearly ? "bg-primary text-primary-foreground" : "text-muted-foreground"
              }`}
            >
              Annuel <span className="text-success">-17%</span>
            </button>
          </div>
        </div>

        <div className="mt-14 grid gap-6 lg:grid-cols-4">
          {plans.map((p) => {
            const price = yearly ? p.yearly : p.monthly;
            return (
              <div
                key={p.name}
                className={`relative flex flex-col rounded-2xl border p-6 transition-all ${
                  p.highlight
                    ? "border-primary bg-card shadow-[var(--shadow-elegant)] lg:-translate-y-2"
                    : "bg-card shadow-soft"
                }`}
              >
                {p.highlight && (
                  <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-gradient-to-r from-primary to-primary-glow px-3 py-1 text-xs font-semibold text-primary-foreground">
                    {p.tagline}
                  </span>
                )}
                <h3 className="text-lg font-bold">{p.name}</h3>
                {!p.highlight && (
                  <p className="text-sm text-muted-foreground">{p.tagline}</p>
                )}

                <div className="mt-4 flex items-end gap-1">
                  {price === null ? (
                    <span className="text-3xl font-extrabold">Sur devis</span>
                  ) : price === 0 ? (
                    <span className="text-3xl font-extrabold">Gratuit</span>
                  ) : (
                    <>
                      <span className="text-3xl font-extrabold">
                        {formatPrice(price)}
                      </span>
                      <span className="mb-1 text-sm text-muted-foreground">
                        FCFA/{yearly ? "an" : "mois"}
                      </span>
                    </>
                  )}
                </div>

                <ul className="mt-6 flex-1 space-y-3">
                  {p.features.map((f) => (
                    <li key={f} className="flex items-start gap-2 text-sm">
                      <Check className="mt-0.5 h-4 w-4 shrink-0 text-success" />
                      <span>{f}</span>
                    </li>
                  ))}
                </ul>

                <Button
                  variant={p.highlight ? "hero" : "outline"}
                  className="mt-6 w-full"
                >
                  {p.cta}
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
