import { ArrowRight, Play, ShieldCheck, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import heroImg from "@/assets/hero-dashboard.jpg";

export function Hero() {
  return (
    <section className="relative overflow-hidden pt-28 pb-16 md:pt-36 md:pb-24">
      {/* ambient background */}
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute left-1/2 top-0 h-[36rem] w-[36rem] -translate-x-1/2 rounded-full bg-primary/15 blur-[120px]" />
        <div className="absolute right-0 top-40 h-72 w-72 rounded-full bg-primary-glow/20 blur-[100px]" />
      </div>

      <div className="container-page grid items-center gap-12 lg:grid-cols-2">
        <div className="text-center lg:text-left">
          <span className="inline-flex items-center gap-2 rounded-full border bg-accent/50 px-4 py-1.5 text-sm font-medium text-accent-foreground">
            <Sparkles className="h-4 w-4" />
            IA + WhatsApp pour vendeurs africains
          </span>

          <h1 className="mt-6 text-4xl font-extrabold leading-[1.05] sm:text-5xl md:text-6xl">
            Automatisez vos ventes.{" "}
            <span className="text-gradient">Gagnez plus.</span> Travaillez moins.
          </h1>

          <p className="mx-auto mt-6 max-w-xl text-lg text-muted-foreground lg:mx-0">
            La plateforme tout-en-un pour les commerçants et e-commerçants du Sénégal
            et d'Afrique francophone. Commandes, paiements Wave & Orange Money, WhatsApp
            et intelligence artificielle réunis en un seul outil.
          </p>

          <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row lg:justify-start">
            <Button variant="hero" size="xl">
              Commencer gratuitement
              <ArrowRight className="h-4 w-4" />
            </Button>
            <Button variant="glass" size="xl">
              <Play className="h-4 w-4" />
              Voir la démo
            </Button>
          </div>

          <p className="mt-4 flex items-center justify-center gap-2 text-sm text-muted-foreground lg:justify-start">
            <ShieldCheck className="h-4 w-4 text-success" />
            Essai gratuit 14 jours · Sans carte bancaire
          </p>
        </div>

        <div className="relative">
          <div className="animate-float overflow-hidden rounded-2xl border shadow-[var(--shadow-elegant)]">
            <img
              src={heroImg}
              alt="Tableau de bord Klika.sn affichant les ventes, commandes WhatsApp et statistiques"
              width={1600}
              height={1200}
              className="w-full"
            />
          </div>
        </div>
      </div>

      <div className="container-page mt-16 grid grid-cols-2 gap-6 border-t pt-10 sm:grid-cols-4">
        {[
          { v: "12 000+", l: "Vendeurs actifs" },
          { v: "2,4 Md", l: "FCFA traités" },
          { v: "98%", l: "Commandes automatisées" },
          { v: "4,9/5", l: "Satisfaction client" },
        ].map((s) => (
          <div key={s.l} className="text-center">
            <div className="text-2xl font-extrabold md:text-3xl">{s.v}</div>
            <div className="mt-1 text-sm text-muted-foreground">{s.l}</div>
          </div>
        ))}
      </div>
    </section>
  );
}
