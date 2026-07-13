import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

const faqs = [
  {
    q: "Ai-je besoin de compétences techniques ?",
    a: "Non. Klika.sn est conçu pour être utilisé sans aucune connaissance technique. La configuration prend moins de 5 minutes.",
  },
  {
    q: "Est-ce que ça fonctionne avec WhatsApp Business ?",
    a: "Oui. Vous connectez votre numéro WhatsApp Business via un QR code et gérez toutes vos conversations depuis une boîte de réception unique.",
  },
  {
    q: "Quels moyens de paiement sont supportés ?",
    a: "Wave, Orange Money, Free Money, PayDunya, carte bancaire et le paiement à la livraison. Tout est intégré à vos commandes.",
  },
  {
    q: "L'IA parle-t-elle wolof ?",
    a: "Oui. L'assistant IA répond en français et en wolof, comprend les messages vocaux et peut prendre les commandes automatiquement.",
  },
  {
    q: "Puis-je essayer gratuitement ?",
    a: "Absolument. Vous bénéficiez d'un essai gratuit de 14 jours sur les plans payants, sans carte bancaire, et d'un plan Starter gratuit à vie.",
  },
  {
    q: "Mes données sont-elles sécurisées ?",
    a: "Oui. Nous utilisons le chiffrement HTTPS, l'authentification sécurisée et une isolation stricte des données de chaque compte.",
  },
];

export function FAQ() {
  return (
    <section id="faq" className="py-20 md:py-28">
      <div className="container-page max-w-3xl">
        <div className="text-center">
          <span className="text-sm font-semibold uppercase tracking-wider text-primary">
            FAQ
          </span>
          <h2 className="mt-3 text-3xl font-extrabold sm:text-4xl">
            Questions fréquentes
          </h2>
        </div>

        <Accordion type="single" collapsible className="mt-10">
          {faqs.map((f, i) => (
            <AccordionItem key={i} value={`item-${i}`}>
              <AccordionTrigger className="text-left text-base font-semibold">
                {f.q}
              </AccordionTrigger>
              <AccordionContent className="text-muted-foreground">
                {f.a}
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </div>
    </section>
  );
}
