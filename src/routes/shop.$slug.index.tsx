import { useMemo, useState } from "react";
import { createFileRoute, Link, getRouteApi } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { MapPin, Phone, ShoppingBag, Plus, Minus, Trash2, Store } from "lucide-react";
import { toast } from "sonner";
import { useCart } from "@/lib/cart";
import { formatMoney, whatsappHref, type ShopProduct } from "@/lib/shop-types";

export const Route = createFileRoute("/shop/$slug/")({
  component: ShopHome,
});

const shopRoute = getRouteApi("/shop/$slug");

function ShopHome() {
  const shop = shopRoute.useLoaderData() as PublicShop;
  const { slug } = Route.useParams();
  const cart = useCart();
  const [categoryId, setCategoryId] = useState<string | "all">("all");
  const [selected, setSelected] = useState<ShopProduct | null>(null);
  const [cartOpen, setCartOpen] = useState(false);

  const { store, categories, products } = shop;
  const currency = store.currency;
  const wa = whatsappHref(store.whatsapp_number);

  const visible = useMemo(
    () => (categoryId === "all" ? products : products.filter((p) => p.category_id === categoryId)),
    [products, categoryId],
  );

  function addProduct(product: ShopProduct) {
    if (product.variants.length > 0) {
      setSelected(product);
      return;
    }
    if (!product.in_stock) {
      toast.error("Ce produit n'est plus disponible.");
      return;
    }
    cart.add({
      productId: product.id,
      variantId: null,
      name: product.name,
      unitPrice: product.price,
      imageUrl: product.image_url,
      maxQuantity: product.available_stock,
    });
    toast.success("Ajouté au panier");
  }

  return (
    <div className="min-h-screen bg-muted/30 pb-28">
      <header className="border-b bg-background">
        <div className="mx-auto max-w-5xl px-4 py-6">
          <div className="flex items-start gap-4">
            {store.logo_url ? (
              <img
                src={store.logo_url}
                alt={`Logo de ${store.name}`}
                loading="lazy"
                className="h-16 w-16 shrink-0 rounded-xl object-cover"
              />
            ) : (
              <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-xl bg-primary/10">
                <Store className="h-7 w-7 text-primary" />
              </div>
            )}
            <div className="min-w-0">
              <h1 className="truncate text-2xl font-bold tracking-tight">{store.name}</h1>
              {store.description && (
                <p className="mt-1 text-sm text-muted-foreground">{store.description}</p>
              )}
              <div className="mt-2 flex flex-wrap gap-3 text-sm text-muted-foreground">
                {store.address && (
                  <span className="inline-flex items-center gap-1">
                    <MapPin className="h-3.5 w-3.5" /> {store.address}
                  </span>
                )}
                {store.phone && (
                  <a href={`tel:${store.phone}`} className="inline-flex items-center gap-1 hover:text-foreground">
                    <Phone className="h-3.5 w-3.5" /> {store.phone}
                  </a>
                )}
                {wa && (
                  <a
                    href={wa}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 hover:text-foreground"
                  >
                    WhatsApp
                  </a>
                )}
              </div>
            </div>
          </div>
        </div>
      </header>

      {categories.length > 0 && (
        <nav className="sticky top-0 z-10 border-b bg-background/95 backdrop-blur">
          <div className="mx-auto flex max-w-5xl gap-2 overflow-x-auto px-4 py-3">
            <CategoryChip active={categoryId === "all"} onClick={() => setCategoryId("all")}>
              Tout
            </CategoryChip>
            {categories.map((c) => (
              <CategoryChip key={c.id} active={categoryId === c.id} onClick={() => setCategoryId(c.id)}>
                {c.name}
              </CategoryChip>
            ))}
          </div>
        </nav>
      )}

      <main className="mx-auto max-w-5xl px-4 py-6">
        <h2 className="sr-only">Produits</h2>
        {visible.length === 0 ? (
          <div className="rounded-xl border bg-background py-20 text-center">
            <ShoppingBag className="mx-auto h-10 w-10 text-muted-foreground" />
            <p className="mt-3 font-medium">Aucun produit disponible pour le moment</p>
            <p className="text-sm text-muted-foreground">Revenez bientôt.</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3">
            {visible.map((p) => (
              <ProductCard key={p.id} product={p} currency={currency} onAdd={() => addProduct(p)} />
            ))}
          </div>
        )}
      </main>

      {cart.count > 0 && (
        <div className="fixed inset-x-0 bottom-0 z-20 border-t bg-background/95 backdrop-blur">
          <div className="mx-auto flex max-w-5xl items-center gap-3 px-4 py-3">
            <Button variant="outline" className="flex-1" onClick={() => setCartOpen(true)}>
              <ShoppingBag className="mr-2 h-4 w-4" />
              Panier ({cart.count})
            </Button>
            <Button asChild variant="hero" className="flex-1">
              <Link to="/shop/$slug/checkout" params={{ slug }}>
                Commander · {formatMoney(cart.subtotal, currency)}
              </Link>
            </Button>
          </div>
        </div>
      )}

      <VariantDialog
        product={selected}
        currency={currency}
        onClose={() => setSelected(null)}
        onAdd={(variantId, name, price, max) => {
          cart.add({
            productId: selected!.id,
            variantId,
            name,
            unitPrice: price,
            imageUrl: selected!.image_url,
            maxQuantity: max,
          });
          toast.success("Ajouté au panier");
          setSelected(null);
        }}
      />

      <Dialog open={cartOpen} onOpenChange={setCartOpen}>
        <DialogContent className="max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Mon panier</DialogTitle>
          </DialogHeader>
          <CartLines currency={currency} />
          <div className="flex items-center justify-between border-t pt-3 font-semibold">
            <span>Sous-total</span>
            <span>{formatMoney(cart.subtotal, currency)}</span>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => cart.clear()} disabled={cart.count === 0}>
              Vider
            </Button>
            <Button asChild variant="hero" className="flex-1" disabled={cart.count === 0}>
              <Link to="/shop/$slug/checkout" params={{ slug }}>
                Passer la commande
              </Link>
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function CategoryChip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`whitespace-nowrap rounded-full border px-4 py-1.5 text-sm transition ${
        active ? "border-primary bg-primary text-primary-foreground" : "hover:bg-muted"
      }`}
    >
      {children}
    </button>
  );
}

function ProductCard({
  product,
  currency,
  onAdd,
}: {
  product: ShopProduct;
  currency: string;
  onAdd: () => void;
}) {
  const available = product.variants.length
    ? product.variants.some((v) => v.in_stock)
    : product.in_stock;
  return (
    <Card className="flex flex-col overflow-hidden">
      <div className="aspect-square w-full bg-muted">
        {product.image_url ? (
          <img
            src={product.image_url}
            alt={product.name}
            loading="lazy"
            decoding="async"
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="flex h-full items-center justify-center">
            <ShoppingBag className="h-8 w-8 text-muted-foreground" />
          </div>
        )}
      </div>
      <div className="flex flex-1 flex-col gap-1 p-3">
        <h3 className="line-clamp-2 text-sm font-medium">{product.name}</h3>
        {product.description && (
          <p className="line-clamp-2 text-xs text-muted-foreground">{product.description}</p>
        )}
        <div className="mt-1 flex items-baseline gap-2">
          <span className="font-semibold">{formatMoney(product.price, currency)}</span>
          {product.compare_at_price && product.compare_at_price > product.price && (
            <span className="text-xs text-muted-foreground line-through">
              {formatMoney(product.compare_at_price, currency)}
            </span>
          )}
        </div>
        {product.available_stock !== null && available && (
          <span className="text-xs text-muted-foreground">
            {product.available_stock} {product.unit} en stock
          </span>
        )}
        <div className="mt-auto pt-2">
          {available ? (
            <Button size="sm" variant="hero" className="w-full" onClick={onAdd}>
              {product.variants.length > 0 ? "Choisir" : "Ajouter"}
            </Button>
          ) : (
            <Badge variant="secondary" className="w-full justify-center py-1.5">
              Rupture de stock
            </Badge>
          )}
        </div>
      </div>
    </Card>
  );
}

function VariantDialog({
  product,
  currency,
  onClose,
  onAdd,
}: {
  product: ShopProduct | null;
  currency: string;
  onClose: () => void;
  onAdd: (variantId: string, name: string, price: number, max: number | null) => void;
}) {
  const [variantId, setVariantId] = useState<string | null>(null);
  const current = product?.variants.find((v) => v.id === variantId) ?? null;

  return (
    <Dialog
      open={!!product}
      onOpenChange={(o) => {
        if (!o) {
          setVariantId(null);
          onClose();
        }
      }}
    >
      <DialogContent className="max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{product?.name}</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">Choisissez une option avant d'ajouter au panier.</p>
        <div className="grid gap-2">
          {product?.variants.map((v) => (
            <button
              key={v.id}
              type="button"
              disabled={!v.in_stock}
              onClick={() => setVariantId(v.id)}
              className={`flex items-center justify-between rounded-lg border px-3 py-2 text-left text-sm transition disabled:opacity-50 ${
                variantId === v.id ? "border-primary ring-1 ring-primary" : "hover:bg-muted"
              }`}
            >
              <span>
                {v.name} : <span className="font-medium">{v.value}</span>
                {!v.in_stock && " — épuisé"}
                {v.in_stock && v.available_stock !== null && ` — ${v.available_stock} dispo.`}
              </span>
              <span className="font-semibold">{formatMoney(v.price, currency)}</span>
            </button>
          ))}
        </div>
        <Button
          variant="hero"
          disabled={!current}
          onClick={() => {
            if (!product || !current) return;
            onAdd(
              current.id,
              `${product.name} — ${current.name}: ${current.value}`,
              current.price,
              current.available_stock,
            );
            setVariantId(null);
          }}
        >
          {current ? `Ajouter · ${formatMoney(current.price, currency)}` : "Sélectionnez une option"}
        </Button>
      </DialogContent>
    </Dialog>
  );
}

export function CartLines({ currency }: { currency: string }) {
  const cart = useCart();
  if (cart.items.length === 0) {
    return <p className="py-6 text-center text-sm text-muted-foreground">Votre panier est vide.</p>;
  }
  return (
    <ul className="divide-y">
      {cart.items.map((i) => (
        <li key={`${i.productId}-${i.variantId ?? "base"}`} className="flex gap-3 py-3">
          {i.imageUrl && (
            <img src={i.imageUrl} alt={i.name} loading="lazy" className="h-14 w-14 rounded-lg object-cover" />
          )}
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium">{i.name}</p>
            <p className="text-sm text-muted-foreground">{formatMoney(i.unitPrice, currency)}</p>
            <div className="mt-1 flex items-center gap-2">
              <Button
                type="button"
                size="icon"
                variant="outline"
                className="h-7 w-7"
                aria-label="Diminuer la quantité"
                onClick={() => cart.setQuantity(i.productId, i.variantId, i.quantity - 1)}
              >
                <Minus className="h-3 w-3" />
              </Button>
              <span className="w-6 text-center text-sm">{i.quantity}</span>
              <Button
                type="button"
                size="icon"
                variant="outline"
                className="h-7 w-7"
                aria-label="Augmenter la quantité"
                onClick={() => cart.setQuantity(i.productId, i.variantId, i.quantity + 1)}
              >
                <Plus className="h-3 w-3" />
              </Button>
              <Button
                type="button"
                size="icon"
                variant="ghost"
                className="h-7 w-7 text-destructive"
                aria-label="Retirer du panier"
                onClick={() => cart.remove(i.productId, i.variantId)}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
          <span className="text-sm font-semibold">{formatMoney(i.unitPrice * i.quantity, currency)}</span>
        </li>
      ))}
    </ul>
  );
}
