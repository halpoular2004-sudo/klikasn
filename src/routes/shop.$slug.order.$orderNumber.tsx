import { createFileRoute, Link } from "@tanstack/react-router";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, MessageCircle, Phone } from "lucide-react";
import { getPublicOrder } from "@/lib/shop.functions";
import { formatMoney, whatsappHref, type PublicOrder } from "@/lib/shop-types";

const statusLabels: Record<string, string> = {
  pending: "En attente de confirmation",
  confirmed: "Confirmée",
  processing: "En préparation",
  shipped: "Expédiée",
  delivered: "Livrée",
  cancelled: "Annulée",
  refunded: "Remboursée",
};

export const Route = createFileRoute("/shop/$slug/order/$orderNumber")({
  validateSearch: z.object({ t: z.string().optional() }),
  loaderDeps: ({ search }) => ({ t: search.t }),
  loader: async ({ params, deps }) => {
    if (!deps.t) return null;
    return (await getPublicOrder({
      data: { slug: params.slug, orderNumber: params.orderNumber, token: deps.t },
    })) as PublicOrder | null;
  },
  head: ({ params }) => ({
    meta: [
      { title: `Commande ${params.orderNumber} — Klika.sn` },
      { name: "description", content: "Détail et statut de votre commande." },
      { name: "robots", content: "noindex" },
    ],
  }),
  errorComponent: () => (
    <Fallback message="Impossible d'afficher cette commande pour le moment. Réessayez dans un instant." />
  ),
  component: OrderPage,
});

function Fallback({ message }: { message: string }) {
  return (
    <div className="mx-auto max-w-lg px-4 py-20 text-center">
      <h1 className="text-xl font-semibold">Commande introuvable</h1>
      <p className="mt-2 text-muted-foreground">{message}</p>
    </div>
  );
}

function OrderPage() {
  const order = Route.useLoaderData() as PublicOrder | null;
  const { slug } = Route.useParams();

  if (!order) {
    return (
      <Fallback message="Ce lien de commande n'est pas valide. Contactez le vendeur avec votre numéro de commande." />
    );
  }

  const wa = whatsappHref(order.store.whatsapp_number);
  const currency = order.currency;

  return (
    <div className="min-h-screen bg-muted/30">
      <div className="mx-auto max-w-2xl space-y-4 px-4 py-10">
        <div className="text-center">
          <CheckCircle2 className="mx-auto h-12 w-12 text-primary" />
          <h1 className="mt-3 text-2xl font-bold">Commande confirmée 🎉</h1>
          <p className="mt-1 text-muted-foreground">
            Numéro <span className="font-medium text-foreground">{order.order_number}</span> ·{" "}
            {order.store.name}
          </p>
          <Badge variant="secondary" className="mt-3">
            {statusLabels[order.status] ?? order.status}
          </Badge>
        </div>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Votre commande</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <ul className="divide-y">
              {order.items.map((i, idx) => (
                <li key={idx} className="flex justify-between py-2">
                  <span className="pr-3">
                    {i.product_name} <span className="text-muted-foreground">× {i.quantity}</span>
                  </span>
                  <span>{formatMoney(i.total, currency)}</span>
                </li>
              ))}
            </ul>
            <div className="flex justify-between border-t pt-2">
              <span className="text-muted-foreground">Sous-total</span>
              <span>{formatMoney(order.subtotal, currency)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">
                Livraison{order.shipping_label ? ` — ${order.shipping_label}` : ""}
              </span>
              <span>{formatMoney(order.shipping, currency)}</span>
            </div>
            {order.discount > 0 && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Remise</span>
                <span>−{formatMoney(order.discount, currency)}</span>
              </div>
            )}
            <div className="flex justify-between border-t pt-2 text-base font-semibold">
              <span>Total</span>
              <span>{formatMoney(order.total, currency)}</span>
            </div>
            {(order.shipping_address || order.shipping_city || order.shipping_district) && (
              <p className="border-t pt-2 text-muted-foreground">
                Livraison à :{" "}
                {[order.shipping_address, order.shipping_district, order.shipping_city]
                  .filter(Boolean)
                  .join(", ")}
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Contacter {order.store.name}</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-2 sm:flex-row">
            {order.store.phone && (
              <Button asChild variant="outline" className="flex-1">
                <a href={`tel:${order.store.phone}`}>
                  <Phone className="mr-2 h-4 w-4" /> {order.store.phone}
                </a>
              </Button>
            )}
            {wa ? (
              <Button asChild variant="outline" className="flex-1">
                <a href={wa} target="_blank" rel="noopener noreferrer">
                  <MessageCircle className="mr-2 h-4 w-4" /> Contacter le vendeur sur WhatsApp
                </a>
              </Button>
            ) : (
              <Button variant="outline" className="flex-1" disabled>
                <MessageCircle className="mr-2 h-4 w-4" /> WhatsApp non disponible
              </Button>
            )}
          </CardContent>
        </Card>

        <Button asChild variant="hero" className="w-full">
          <Link to="/shop/$slug" params={{ slug }}>
            Retour à la boutique
          </Link>
        </Button>
      </div>
    </div>
  );
}
