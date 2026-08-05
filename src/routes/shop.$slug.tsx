import { createFileRoute, notFound, Outlet, Link } from "@tanstack/react-router";
import { getPublicShop } from "@/lib/shop.functions";
import { CartProvider } from "@/lib/cart";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/shop/$slug")({
  loader: async ({ params }) => {
    const shop = await getPublicShop({ data: { slug: params.slug } });
    if (!shop) throw notFound();
    return shop;
  },
  head: ({ loaderData, params }) => {
    if (!loaderData) {
      return {
        meta: [
          { title: "Boutique introuvable — Klika.sn" },
          { name: "robots", content: "noindex" },
        ],
      };
    }
    const { store } = loaderData;
    const title = `${store.name}${store.address ? ` — ${store.address}` : ""} | Klika.sn`;
    const description =
      store.description?.slice(0, 155) ??
      `Découvrez et commandez les produits de ${store.name} en ligne, livraison rapide.`;
    return {
      meta: [
        { title },
        { name: "description", content: description },
        { property: "og:title", content: title },
        { property: "og:description", content: description },
        { property: "og:type", content: "website" },
        { name: "twitter:card", content: "summary_large_image" },
        ...(store.logo_url?.startsWith("https://")
          ? [
              { property: "og:image", content: store.logo_url },
              { name: "twitter:image", content: store.logo_url },
            ]
          : []),
      ],
      links: [{ rel: "canonical", href: `/shop/${params.slug}` }],
    };
  },
  errorComponent: ShopError,
  notFoundComponent: ShopNotFound,
  component: ShopLayout,
});

function ShopLayout() {
  const { slug } = Route.useParams();
  return (
    <CartProvider slug={slug}>
      <Outlet />
    </CartProvider>
  );
}

function Shell({ title, message }: { title: string; message: string }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-6 text-center">
      <div className="max-w-md space-y-3">
        <h1 className="text-2xl font-bold">{title}</h1>
        <p className="text-muted-foreground">{message}</p>
        <Button asChild variant="hero">
          <Link to="/">Retour à Klika.sn</Link>
        </Button>
      </div>
    </div>
  );
}

function ShopNotFound() {
  return (
    <Shell
      title="Boutique introuvable"
      message="Ce lien ne correspond à aucune boutique active. Vérifiez l'adresse auprès du vendeur."
    />
  );
}

function ShopError() {
  return (
    <Shell
      title="Boutique indisponible"
      message="Une erreur est survenue lors du chargement de la boutique. Réessayez dans un instant."
    />
  );
}
