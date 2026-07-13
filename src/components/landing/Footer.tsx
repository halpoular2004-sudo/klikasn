import { Zap } from "lucide-react";

const columns = [
  {
    title: "Produit",
    links: ["Fonctionnalités", "Tarifs", "Automatisations", "IA & WhatsApp", "Analytics"],
  },
  {
    title: "Entreprise",
    links: ["À propos", "Blog", "Carrières", "Partenaires", "Contact"],
  },
  {
    title: "Ressources",
    links: ["Centre d'aide", "Documentation", "Statut", "API", "Sécurité"],
  },
  {
    title: "Légal",
    links: ["Conditions", "Confidentialité", "Cookies", "Mentions légales"],
  },
];

export function Footer() {
  return (
    <footer className="border-t bg-navy text-navy-foreground">
      <div className="container-page py-16">
        <div className="grid gap-10 md:grid-cols-2 lg:grid-cols-6">
          <div className="lg:col-span-2">
            <div className="flex items-center gap-2 text-lg font-extrabold">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-primary to-primary-glow text-primary-foreground">
                <Zap className="h-5 w-5" />
              </span>
              Klika<span className="text-primary-glow">.sn</span>
            </div>
            <p className="mt-4 max-w-xs text-sm text-navy-foreground/60">
              Automatisez vos ventes. Gagnez plus. Travaillez moins. La plateforme
              d'automatisation commerciale n°1 d'Afrique francophone.
            </p>
          </div>

          {columns.map((c) => (
            <div key={c.title}>
              <h4 className="text-sm font-semibold">{c.title}</h4>
              <ul className="mt-4 space-y-2">
                {c.links.map((l) => (
                  <li key={l}>
                    <a
                      href="#"
                      className="text-sm text-navy-foreground/60 transition-colors hover:text-navy-foreground"
                    >
                      {l}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-12 flex flex-col items-center justify-between gap-4 border-t border-white/10 pt-8 text-sm text-navy-foreground/60 sm:flex-row">
          <p>© {new Date().getFullYear()} Klika.sn. Tous droits réservés.</p>
          <p>Conçu avec ❤️ à Dakar pour l'Afrique francophone.</p>
        </div>
      </div>
    </footer>
  );
}
