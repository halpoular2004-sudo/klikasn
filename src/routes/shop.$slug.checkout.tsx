import { useMemo, useRef, useState } from "react";
import { createFileRoute, getRouteApi, Link, useNavigate } from "@tanstack/react-router";
import { useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useCart } from "@/lib/cart";
import { createPublicOrder } from "@/lib/shop.functions";
import { formatMoney, type PublicShop } from "@/lib/shop-types";

export const Route = createFileRoute("/shop/$slug/checkout")({
  component: CheckoutPage,
  head: () => ({
    meta: [
      { title: "Finaliser ma commande — Klika.sn" },
      { name: "description", content: "Renseignez vos coordonnées et validez votre commande." },
      { name: "robots", content: "noindex" },
    ],
  }),
});

const shopRoute = getRouteApi("/shop/$slug");

function newKey() {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function CheckoutPage() {
  const shop = shopRoute.useLoaderData() as PublicShop;
  const { slug } = Route.useParams();
  const cart = useCart();
  const navigate = useNavigate();
  const currency = shop.store.currency;
  const options = shop.shipping_options;

  const [shippingId, setShippingId] = useState<string | null>(options[0]?.id ?? null);
  const idempotencyKey = useRef(newKey());

  const shippingCost = useMemo(
    () => options.find((o) => o.id === shippingId)?.price ?? 0,
    [options, shippingId],
  );
  const total = cart.subtotal + shippingCost;

  const submit = useMutation({
    mutationFn: async (form: FormData) => {
      if (cart.items.length === 0) throw new Error("Votre panier est vide.");
      return createPublicOrder({
        data: {
          slug,
          items: cart.items.map((i) => ({
            product_id: i.productId,
            variant_id: i.variantId,
            quantity: i.quantity,
          })),
          customer: {
            name: String(form.get("name") ?? "").trim(),
            phone: String(form.get("phone") ?? "").trim(),
            whatsapp: String(form.get("whatsapp") ?? "").trim(),
            email: String(form.get("email") ?? "").trim(),
            address: String(form.get("address") ?? "").trim(),
            city: String(form.get("city") ?? "").trim(),
            district: String(form.get("district") ?? "").trim(),
          },
          shipping_option_id: shippingId,
          notes: String(form.get("notes") ?? "").trim(),
          idempotency_key: idempotencyKey.current,
        },
      });
    },
    onSuccess: (res) => {
      if (res.duplicate) toast.info("Votre commande a déjà été enregistrée.");
      cart.clear();
      navigate({
        to: "/shop/$slug/order/$orderNumber",
        params: { slug, orderNumber: res.order_number },
        search: { t: res.public_token },
      });
    },
    onError: (e: Error) =>
      toast.error(e.message || "Impossible de créer la commande. Veuillez réessayer."),
  });

  if (cart.items.length === 0 && !submit.isPending) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-16 text-center">
        <h1 className="text-xl font-semibold">Votre panier est vide</h1>
        <p className="mt-2 text-muted-foreground">Ajoutez des produits avant de commander.</p>
        <Button asChild variant="hero" className="mt-4">
          <Link to="/shop/$slug" params={{ slug }}>
            Retour à la boutique
          </Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-muted/30">
      <header className="border-b bg-background">
        <div className="mx-auto flex max-w-3xl items-center gap-3 px-4 py-4">
          <Button asChild variant="ghost" size="icon" aria-label="Retour à la boutique">
            <Link to="/shop/$slug" params={{ slug }}>
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <h1 className="text-lg font-semibold">Finaliser ma commande</h1>
        </div>
      </header>

      <form
        className="mx-auto max-w-3xl space-y-4 px-4 py-6"
        onSubmit={(e) => {
          e.preventDefault();
          if (submit.isPending) return;
          submit.mutate(new FormData(e.currentTarget));
        }}
      >
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Vos coordonnées</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="name">Prénom et nom *</Label>
              <Input id="name" name="name" required maxLength={120} autoComplete="name" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="phone">Téléphone *</Label>
              <Input id="phone" name="phone" required maxLength={30} inputMode="tel" autoComplete="tel" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="whatsapp">WhatsApp</Label>
              <Input id="whatsapp" name="whatsapp" maxLength={30} inputMode="tel" />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="email">Email (facultatif)</Label>
              <Input id="email" name="email" type="email" maxLength={255} autoComplete="email" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Livraison</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="address">Adresse</Label>
              <Input id="address" name="address" maxLength={300} autoComplete="street-address" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="city">Ville</Label>
              <Input id="city" name="city" maxLength={120} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="district">Quartier</Label>
              <Input id="district" name="district" maxLength={120} />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="notes">Instructions (facultatif)</Label>
              <Textarea id="notes" name="notes" maxLength={500} rows={2} />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label>Option de livraison</Label>
              {options.length === 0 ? (
                <p className="rounded-lg border bg-background px-3 py-2 text-sm text-muted-foreground">
                  Livraison à définir avec le vendeur
                  {shop.store.shipping_note ? ` — ${shop.store.shipping_note}` : ""}
                </p>
              ) : (
                <div className="grid gap-2">
                  {options.map((o) => (
                    <button
                      key={o.id}
                      type="button"
                      onClick={() => setShippingId(o.id)}
                      className={`flex items-center justify-between rounded-lg border px-3 py-2 text-left text-sm transition ${
                        shippingId === o.id ? "border-primary ring-1 ring-primary" : "hover:bg-muted"
                      }`}
                    >
                      <span>{o.name}</span>
                      <span className="font-medium">{formatMoney(o.price, currency)}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Récapitulatif</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <ul className="divide-y">
              {cart.items.map((i) => (
                <li key={`${i.productId}-${i.variantId ?? "base"}`} className="flex justify-between py-2">
                  <span className="pr-3">
                    {i.name} <span className="text-muted-foreground">× {i.quantity}</span>
                  </span>
                  <span>{formatMoney(i.unitPrice * i.quantity, currency)}</span>
                </li>
              ))}
            </ul>
            <div className="flex justify-between border-t pt-2">
              <span className="text-muted-foreground">Sous-total</span>
              <span>{formatMoney(cart.subtotal, currency)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Livraison</span>
              <span>{options.length === 0 ? "À définir" : formatMoney(shippingCost, currency)}</span>
            </div>
            <div className="flex justify-between border-t pt-2 text-base font-semibold">
              <span>Total</span>
              <span>{formatMoney(total, currency)}</span>
            </div>
            <p className="text-xs text-muted-foreground">
              Le montant final est recalculé et confirmé par la boutique.
            </p>
          </CardContent>
        </Card>

        <Button type="submit" variant="hero" size="lg" className="w-full" disabled={submit.isPending}>
          {submit.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Commander
        </Button>
      </form>
    </div>
  );
}
