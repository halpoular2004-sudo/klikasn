import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import type { Database } from "@/integrations/supabase/types";
import type { PublicOrder, PublicShop } from "./shop-types";

function publicClient() {
  return createClient<Database>(
    process.env["SUPABASE_URL"]!,
    process.env["SUPABASE_PUBLISHABLE_KEY"]!,
    { auth: { storage: undefined, persistSession: false, autoRefreshToken: false } },
  );
}

const slugSchema = z.string().trim().min(1).max(120);

const itemSchema = z.object({
  product_id: z.string().uuid(),
  variant_id: z.string().uuid().nullable().optional(),
  quantity: z.number().int().min(1).max(999),
});

const checkoutSchema = z.object({
  slug: slugSchema,
  items: z.array(itemSchema).min(1).max(50),
  customer: z.object({
    name: z.string().trim().min(2).max(120),
    phone: z.string().trim().min(6).max(30),
    whatsapp: z.string().trim().max(30).optional().or(z.literal("")),
    email: z.string().trim().email().max(255).optional().or(z.literal("")),
    address: z.string().trim().max(300).optional().or(z.literal("")),
    city: z.string().trim().max(120).optional().or(z.literal("")),
    district: z.string().trim().max(120).optional().or(z.literal("")),
  }),
  shipping_option_id: z.string().uuid().nullable().optional(),
  notes: z.string().trim().max(500).optional().or(z.literal("")),
  idempotency_key: z.string().trim().min(8).max(64),
});

/** Traduit une erreur Postgres en message compréhensible pour un client final. */
function friendlyError(message: string | undefined) {
  const m = message ?? "";
  if (/Stock insuffisant/i.test(m)) return "Le stock disponible a changé. Vérifiez votre panier.";
  if (/variante/i.test(m)) return "Cette variante n'est plus disponible.";
  if (/n'est plus disponible|introuvable/i.test(m)) return "Ce produit n'est plus disponible.";
  if (/livraison/i.test(m)) return "Cette option de livraison n'est plus disponible.";
  if (/téléphone/i.test(m)) return "Numéro de téléphone invalide.";
  if (/Nom du client/i.test(m)) return "Merci d'indiquer votre nom complet.";
  return "Impossible de créer la commande. Veuillez réessayer.";
}

export const getPublicShop = createServerFn({ method: "GET" })
  .inputValidator((data: unknown) => z.object({ slug: slugSchema }).parse(data))
  .handler(async ({ data }) => {
    const { data: shop, error } = await publicClient().rpc("get_public_shop", {
      p_slug: data.slug,
    });
    if (error) {
      console.error("[shop] get_public_shop", error);
      throw new Error("Boutique indisponible pour le moment.");
    }
    return (shop as PublicShop | null) ?? null;
  });

export const getPublicOrder = createServerFn({ method: "GET" })
  .inputValidator((data: unknown) =>
    z.object({ slug: slugSchema, orderNumber: z.string().trim().max(40), token: z.string().uuid() }).parse(data),
  )
  .handler(async ({ data }) => {
    const { data: order, error } = await publicClient().rpc("get_public_order", {
      p_slug: data.slug,
      p_order_number: data.orderNumber,
      p_token: data.token,
    });
    if (error) {
      console.error("[shop] get_public_order", error);
      throw new Error("Commande indisponible pour le moment.");
    }
    return (order as PublicOrder | null) ?? null;
  });

export const createPublicOrder = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => checkoutSchema.parse(data))
  .handler(async ({ data }) => {
    const { data: result, error } = await publicClient().rpc("create_public_order", {
      p_slug: data.slug,
      p_items: data.items.map((i) => ({
        product_id: i.product_id,
        variant_id: i.variant_id ?? "",
        quantity: i.quantity,
      })),
      p_customer: data.customer,
      p_shipping_option_id: data.shipping_option_id ?? undefined,
      p_notes: data.notes || undefined,
      p_idempotency_key: data.idempotency_key,
    });
    if (error) {
      console.error("[shop] create_public_order", error);
      throw new Error(friendlyError(error.message));
    }
    const payload = result as {
      order_number: string;
      public_token: string;
      total: number;
      duplicate: boolean;
    };
    return payload;
  });
