export type ShopVariant = {
  id: string;
  name: string;
  value: string;
  price: number;
  in_stock: boolean;
  available_stock: number | null;
};

export type ShopProduct = {
  id: string;
  category_id: string | null;
  name: string;
  description: string | null;
  price: number;
  compare_at_price: number | null;
  image_url: string | null;
  unit: string;
  in_stock: boolean;
  available_stock: number | null;
  variants: ShopVariant[];
};

export type ShopCategory = { id: string; name: string; description: string | null };

export type ShopShippingOption = { id: string; name: string; price: number };

export type ShopStore = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  logo_url: string | null;
  currency: string;
  country: string;
  phone: string | null;
  whatsapp_number: string | null;
  address: string | null;
  show_stock: boolean;
  shipping_note: string | null;
};

export type PublicShop = {
  store: ShopStore;
  categories: ShopCategory[];
  products: ShopProduct[];
  shipping_options: ShopShippingOption[];
};

export type PublicOrder = {
  order_number: string;
  status: string;
  payment_status: string;
  subtotal: number;
  shipping: number;
  discount: number;
  total: number;
  currency: string;
  created_at: string;
  shipping_label: string | null;
  shipping_address: string | null;
  shipping_city: string | null;
  shipping_district: string | null;
  store: {
    name: string;
    slug: string;
    phone: string | null;
    whatsapp_number: string | null;
    logo_url: string | null;
  };
  items: { product_name: string; quantity: number; unit_price: number; total: number }[];
};

export function formatMoney(amount: number, currency = "XOF") {
  const value = new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 }).format(
    Math.round(amount),
  );
  return `${value} ${currency === "XOF" ? "FCFA" : currency}`;
}

/** Nettoie un numéro pour un lien wa.me. Renvoie null si le numéro n'est pas exploitable. */
export function whatsappHref(raw: string | null | undefined) {
  if (!raw) return null;
  const digits = raw.replace(/[^0-9]/g, "");
  if (digits.length < 8) return null;
  return `https://wa.me/${digits}`;
}
