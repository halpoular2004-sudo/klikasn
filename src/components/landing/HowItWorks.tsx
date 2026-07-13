import { UserPlus, Boxes, Rocket } from "lucide-react";

const steps = [
  {
    icon: UserPlus,
    step: "01",
    title: "Créez votre compte",
    desc: "Inscription en 2 minutes. Connectez votre numéro WhatsApp Business via un simple QR code.",
  },
  {
    icon: Boxes,
    step: "02",
    title: "Ajoutez vos produits",
    desc: "Importez votre catalogue, définissez vos prix, promotions et stock. Partagez votre lien de boutique.",
  },
  {
    icon: Rocket,
    step: "03",
    title: "Vendez en automatique",
    desc: "L'IA répond, prend les commandes, encaisse via Wave/Orange Money et relance vos clients.",
  },
];

export function HowItWorks() {
  return (
    <section id="how" className="bg-navy py-20 text-navy-foreground md:py-28">
      <div className="container-page">
        <div className="mx-auto max-w-2xl text-center">
          <span className="text-sm font-semibold uppercase tracking-wider text-primary-glow">
            Comment ça marche
          </span>
          <h2 className="mt-3 text-3xl font-extrabold sm:text-4xl">
            Lancez-vous en 3 étapes simples
          </h2>
        </div>

        <div className="mt-16 grid gap-8 md:grid-cols-3">
          {steps.map((s) => (
            <div key={s.step} className="relative rounded-2xl border border-white/10 bg-white/5 p-8 backdrop-blur">
              <div className="text-5xl font-extrabold text-white/10">{s.step}</div>
              <div className="-mt-6 flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-primary-glow text-primary-foreground">
                <s.icon className="h-6 w-6" />
              </div>
              <h3 className="mt-5 text-xl font-bold">{s.title}</h3>
              <p className="mt-2 text-sm text-navy-foreground/70">{s.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
