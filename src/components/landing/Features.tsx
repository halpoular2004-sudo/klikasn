import {
  MessageCircle,
  Bot,
  ShoppingBag,
  CreditCard,
  Truck,
  Users,
  Workflow,
  BarChart3,
  Share2,
} from "lucide-react";

const features = [
  {
    icon: MessageCircle,
    title: "WhatsApp Business",
    desc: "Boîte de réception unifiée, réponses rapides, templates, confirmations et relances automatiques.",
  },
  {
    icon: Bot,
    title: "Assistant IA",
    desc: "Répond aux clients en français et en wolof, prend les commandes et comprend les messages vocaux.",
  },
  {
    icon: ShoppingBag,
    title: "Gestion des commandes",
    desc: "Suivez chaque commande : nouvelle, confirmée, préparation, expédiée, livrée. Export PDF & Excel.",
  },
  {
    icon: CreditCard,
    title: "Paiements locaux",
    desc: "Wave, Orange Money, Free Money, PayDunya, carte bancaire et paiement à la livraison.",
  },
  {
    icon: Share2,
    title: "Catalogue partageable",
    desc: "Un lien public et un QR code pour vendre partout. Commande directe via WhatsApp.",
  },
  {
    icon: Truck,
    title: "Module livraison",
    desc: "Assignez vos livreurs, suivez les tournées en temps réel et notifiez vos clients.",
  },
  {
    icon: Workflow,
    title: "Automatisations",
    desc: "Un moteur visuel : déclencheurs, actions WhatsApp/SMS, factures, tâches et rappels.",
  },
  {
    icon: Users,
    title: "CRM & Clients",
    desc: "Fiches clients, segments, tags, clients VIP et relances des clients inactifs.",
  },
  {
    icon: BarChart3,
    title: "Analytics",
    desc: "CA, conversion, panier moyen, top produits et ventes par jour, mois et canal.",
  },
];

export function Features() {
  return (
    <section id="features" className="py-20 md:py-28">
      <div className="container-page">
        <div className="mx-auto max-w-2xl text-center">
          <span className="text-sm font-semibold uppercase tracking-wider text-primary">
            Fonctionnalités
          </span>
          <h2 className="mt-3 text-3xl font-extrabold sm:text-4xl">
            Tout ce qu'il faut pour vendre plus, sans effort
          </h2>
          <p className="mt-4 text-muted-foreground">
            Une suite complète pensée pour les commerçants d'Afrique francophone.
          </p>
        </div>

        <div className="mt-14 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {features.map((f) => (
            <div
              key={f.title}
              className="group rounded-2xl border bg-card p-6 shadow-soft transition-all hover:-translate-y-1 hover:shadow-[var(--shadow-elegant)]"
            >
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-accent text-primary transition-colors group-hover:bg-gradient-to-br group-hover:from-primary group-hover:to-primary-glow group-hover:text-primary-foreground">
                <f.icon className="h-6 w-6" />
              </div>
              <h3 className="mt-5 text-lg font-bold">{f.title}</h3>
              <p className="mt-2 text-sm text-muted-foreground">{f.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
