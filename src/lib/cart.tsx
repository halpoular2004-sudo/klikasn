import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

export type CartItem = {
  productId: string;
  variantId: string | null;
  name: string;
  unitPrice: number;
  quantity: number;
  imageUrl: string | null;
  maxQuantity: number | null;
};

type CartContextValue = {
  items: CartItem[];
  add: (item: Omit<CartItem, "quantity">, quantity?: number) => void;
  setQuantity: (productId: string, variantId: string | null, quantity: number) => void;
  remove: (productId: string, variantId: string | null) => void;
  clear: () => void;
  count: number;
  subtotal: number;
};

const CartContext = createContext<CartContextValue | null>(null);

const key = (slug: string) => `klika-cart:${slug}`;
const same = (i: CartItem, productId: string, variantId: string | null) =>
  i.productId === productId && (i.variantId ?? null) === (variantId ?? null);

export function CartProvider({ slug, children }: { slug: string; children: ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(key(slug));
      setItems(raw ? (JSON.parse(raw) as CartItem[]) : []);
    } catch {
      setItems([]);
    }
    setHydrated(true);
  }, [slug]);

  useEffect(() => {
    if (!hydrated) return;
    try {
      localStorage.setItem(key(slug), JSON.stringify(items));
    } catch {
      /* quota / navigation privée : le panier reste en mémoire */
    }
  }, [items, slug, hydrated]);

  const value = useMemo<CartContextValue>(() => {
    const cap = (item: CartItem, qty: number) =>
      Math.max(1, item.maxQuantity ? Math.min(qty, item.maxQuantity) : qty);

    return {
      items,
      add: (item, quantity = 1) =>
        setItems((prev) => {
          const existing = prev.find((i) => same(i, item.productId, item.variantId));
          if (existing) {
            return prev.map((i) =>
              same(i, item.productId, item.variantId)
                ? { ...i, quantity: cap(i, i.quantity + quantity) }
                : i,
            );
          }
          return [...prev, { ...item, quantity: Math.max(1, quantity) }];
        }),
      setQuantity: (productId, variantId, quantity) =>
        setItems((prev) =>
          quantity <= 0
            ? prev.filter((i) => !same(i, productId, variantId))
            : prev.map((i) => (same(i, productId, variantId) ? { ...i, quantity: cap(i, quantity) } : i)),
        ),
      remove: (productId, variantId) =>
        setItems((prev) => prev.filter((i) => !same(i, productId, variantId))),
      clear: () => setItems([]),
      count: items.reduce((s, i) => s + i.quantity, 0),
      subtotal: items.reduce((s, i) => s + i.quantity * i.unitPrice, 0),
    };
  }, [items]);

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart doit être utilisé dans un CartProvider");
  return ctx;
}
