import { Check } from "lucide-react";
import dashboardImg from "@/assets/dashboard-preview.jpg";

const points = [
  "Vue d'ensemble : commandes, ventes du jour, CA mensuel",
  "Graphiques interactifs et activité en temps réel",
  "Produits populaires et commandes en attente",
  "Tableaux de bord dédiés par rôle : admin, marchand, employé, livreur",
];

export function DashboardShowcase() {
  return (
    <section className="py-20 md:py-28">
      <div className="container-page grid items-center gap-12 lg:grid-cols-2">
        <div className="order-2 lg:order-1">
          <div className="overflow-hidden rounded-2xl border shadow-[var(--shadow-elegant)]">
            <img
              src={dashboardImg}
              alt="Tableau de bord Klika.sn en français avec revenus, statuts de commandes et ventes par canal"
              loading="lazy"
              width={1600}
              height={1104}
              className="w-full"
            />
          </div>
        </div>

        <div className="order-1 lg:order-2">
          <span className="text-sm font-semibold uppercase tracking-wider text-primary">
            Tableau de bord
          </span>
          <h2 className="mt-3 text-3xl font-extrabold sm:text-4xl">
            Pilotez votre commerce en un coup d'œil
          </h2>
          <p className="mt-4 text-muted-foreground">
            Un dashboard premium, rapide et clair. Toutes vos données commerciales
            réunies, en FCFA, accessibles sur mobile, tablette et ordinateur.
          </p>

          <ul className="mt-8 space-y-4">
            {points.map((p) => (
              <li key={p} className="flex items-start gap-3">
                <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-success/15 text-success">
                  <Check className="h-4 w-4" />
                </span>
                <span className="text-sm font-medium">{p}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}
