import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";

export function CTA() {
  return (
    <section className="py-20 md:py-24">
      <div className="container-page">
        <div className="relative overflow-hidden rounded-3xl bg-navy px-6 py-16 text-center text-navy-foreground md:px-16">
          <div className="pointer-events-none absolute inset-0">
            <div className="absolute left-1/4 top-0 h-72 w-72 rounded-full bg-primary/30 blur-[100px]" />
            <div className="absolute right-1/4 bottom-0 h-72 w-72 rounded-full bg-primary-glow/25 blur-[100px]" />
          </div>
          <div className="relative">
            <h2 className="mx-auto max-w-2xl text-3xl font-extrabold sm:text-4xl">
              Prêt à automatiser vos ventes ?
            </h2>
            <p className="mx-auto mt-4 max-w-xl text-navy-foreground/70">
              Rejoignez des milliers de vendeurs qui gagnent du temps et vendent plus
              avec Klika.sn. Essai gratuit, sans carte bancaire.
            </p>
            <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Button variant="hero" size="xl">
                Commencer gratuitement
                <ArrowRight className="h-4 w-4" />
              </Button>
              <Button
                size="xl"
                className="border border-white/20 bg-white/5 text-navy-foreground hover:bg-white/10"
              >
                Voir la démo
              </Button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
