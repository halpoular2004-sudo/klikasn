import { useMemo, useRef, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { useCurrentStore } from "@/hooks/useCurrentStore";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Plus, Loader2, ShoppingCart, Search, Trash2, UserPlus } from "lucide-react";
import { toast } from "sonner";

const STATUS_LABELS: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  pending: { label: "En attente", variant: "secondary" },
  confirmed: { label: "Confirmée", variant: "default" },
  processing: { label: "En préparation", variant: "default" },
  shipped: { label: "Expédiée", variant: "default" },
  delivered: { label: "Livrée", variant: "default" },
  cancelled: { label: "Annulée", variant: "destructive" },
  refunded: { label: "Remboursée", variant: "outline" },
};

const ALLOWED_TRANSITIONS: Record<string, string[]> = {
  pending: ["confirmed", "cancelled"],
  confirmed: ["processing", "cancelled"],
  processing: ["shipped", "cancelled"],
  shipped: ["delivered"],
  delivered: ["refunded"],
  cancelled: [],
  refunded: [],
};

const CHANNELS = [
  { value: "whatsapp", label: "WhatsApp" },
  { value: "facebook", label: "Facebook" },
  { value: "instagram", label: "Instagram" },
  { value: "tiktok", label: "TikTok" },
  { value: "website", label: "Site web" },
  { value: "in_store", label: "Boutique" },
  { value: "other", label: "Autre" },
];

const PAYMENT_STATUSES = [
  { value: "unpaid", label: "Non payé" },
  { value: "partial", label: "Partiel" },
  { value: "paid", label: "Payé" },
];

const PAYMENT_METHODS = [
  { value: "wave", label: "Wave" },
  { value: "orange_money", label: "Orange Money" },
  { value: "free_money", label: "Free Money" },
  { value: "cash", label: "Espèces" },
  { value: "card", label: "Carte" },
  { value: "paydunya", label: "PayDunya" },
  { value: "stripe", label: "Stripe" },
  { value: "other", label: "Autre" },
];

const fmt = (n: number) => `${new Intl.NumberFormat("fr-FR").format(Number(n) || 0)} FCFA`;

export const Route = createFileRoute("/_authenticated/orders")({
  component: OrdersPage,
  head: () => ({
    meta: [
      { title: "Commandes — Klika.sn" },
      { name: "description", content: "Créez et suivez vos commandes, stocks et paiements sur Klika.sn." },
      { name: "robots", content: "noindex" },
    ],
  }),
});

type CartLine = {
  key: string;
  productId: string;
  variantId: string | null;
  label: string;
  unitPrice: number;
  stock: number;
  quantity: number;
};

function OrdersPage() {
  const { data: store } = useCurrentStore();
  const qc = useQueryClient();
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [pendingStatus, setPendingStatus] = useState<{ id: string; status: string } | null>(null);

  const orders = useQuery({
    queryKey: ["orders", store?.id],
    enabled: !!store?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("orders")
        .select("*, customer:customers(name, phone), order_items(id)")
        .eq("store_id", store!.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const updateStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { error } = await supabase.rpc("update_order_status", { p_order_id: id, p_status: status });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Statut mis à jour");
      qc.invalidateQueries({ queryKey: ["orders"] });
      qc.invalidateQueries({ queryKey: ["order-detail"] });
      qc.invalidateQueries({ queryKey: ["inventory-products"] });
      qc.invalidateQueries({ queryKey: ["order-products"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const filtered = (orders.data ?? []).filter((o) =>
    q ? o.order_number.toLowerCase().includes(q.toLowerCase()) : true,
  );

  return (
    <DashboardShell
      title="Commandes"
      description="Toutes les commandes de votre boutique"
      actions={
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button variant="hero" size="sm" disabled={!store}>
              <Plus className="mr-2 h-4 w-4" /> Nouvelle commande
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Créer une commande</DialogTitle>
              <DialogDescription>Prix et stocks sont vérifiés côté serveur.</DialogDescription>
            </DialogHeader>
            {open && <OrderForm storeId={store?.id ?? null} onDone={() => setOpen(false)} />}
          </DialogContent>
        </Dialog>
      }
    >
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center gap-2 mb-4">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input placeholder="N° commande..." className="pl-9" value={q} onChange={(e) => setQ(e.target.value)} />
            </div>
          </div>

          {orders.isLoading ? (
            <div className="py-16 text-center"><Loader2 className="mx-auto h-6 w-6 animate-spin" /></div>
          ) : filtered.length === 0 ? (
            <div className="py-16 text-center">
              <ShoppingCart className="mx-auto h-10 w-10 text-muted-foreground" />
              <p className="mt-3 font-medium">Aucune commande</p>
              <p className="text-sm text-muted-foreground">Créez votre première commande.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>N°</TableHead>
                    <TableHead>Client</TableHead>
                    <TableHead>Articles</TableHead>
                    <TableHead>Total</TableHead>
                    <TableHead>Paiement</TableHead>
                    <TableHead>Canal</TableHead>
                    <TableHead>Statut</TableHead>
                    <TableHead>Date</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((o) => {
                    const st = STATUS_LABELS[o.status] ?? { label: o.status, variant: "secondary" as const };
                    const items = (o as unknown as { order_items?: { id: string }[] }).order_items ?? [];
                    const customer = (o as unknown as { customer?: { name?: string } | null }).customer;
                    const transitions = ALLOWED_TRANSITIONS[o.status] ?? [];
                    return (
                      <TableRow key={o.id} className="cursor-pointer" onClick={() => setDetailId(o.id)}>
                        <TableCell className="font-medium">{o.order_number}</TableCell>
                        <TableCell>{customer?.name ?? "—"}</TableCell>
                        <TableCell>{items.length}</TableCell>
                        <TableCell>{fmt(Number(o.total))}</TableCell>
                        <TableCell>
                          <Badge variant="outline">
                            {PAYMENT_STATUSES.find((p) => p.value === o.payment_status)?.label ?? o.payment_status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {CHANNELS.find((c) => c.value === o.channel)?.label ?? o.channel}
                        </TableCell>
                        <TableCell onClick={(e) => e.stopPropagation()}>
                          <Select
                            value={o.status}
                            disabled={transitions.length === 0 || updateStatus.isPending}
                            onValueChange={(v) => setPendingStatus({ id: o.id, status: v })}
                          >
                            <SelectTrigger className="w-36 h-8">
                              <SelectValue><Badge variant={st.variant}>{st.label}</Badge></SelectValue>
                            </SelectTrigger>
                            <SelectContent>
                              {transitions.map((k) => (
                                <SelectItem key={k} value={k}>{STATUS_LABELS[k]?.label ?? k}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell className="text-muted-foreground text-xs">
                          {new Date(o.created_at).toLocaleDateString("fr-FR")}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <OrderDetailDialog orderId={detailId} onClose={() => setDetailId(null)} />

      <AlertDialog open={!!pendingStatus} onOpenChange={(o) => !o && setPendingStatus(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Changer le statut ?</AlertDialogTitle>
            <AlertDialogDescription>
              {pendingStatus?.status === "cancelled" || pendingStatus?.status === "refunded"
                ? "Le stock des articles sera remis en inventaire."
                : `La commande passera au statut « ${STATUS_LABELS[pendingStatus?.status ?? ""]?.label ?? ""} ».`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (pendingStatus) updateStatus.mutate(pendingStatus);
                setPendingStatus(null);
              }}
            >
              Confirmer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </DashboardShell>
  );
}

function OrderDetailDialog({ orderId, onClose }: { orderId: string | null; onClose: () => void }) {
  const detail = useQuery({
    queryKey: ["order-detail", orderId],
    enabled: !!orderId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("orders")
        .select("*, customer:customers(name, phone, email, address, city), order_items(*)")
        .eq("id", orderId!)
        .single();
      if (error) throw error;
      return data;
    },
  });

  const o = detail.data;
  const customer = (o as unknown as { customer?: { name?: string; phone?: string | null } | null } | undefined)?.customer;
  const items = ((o as unknown as { order_items?: { id: string; product_name: string; quantity: number; unit_price: number; total: number }[] } | undefined)?.order_items) ?? [];

  return (
    <Dialog open={!!orderId} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Commande {o?.order_number ?? ""}</DialogTitle>
        </DialogHeader>
        {detail.isLoading || !o ? (
          <div className="py-10 text-center"><Loader2 className="mx-auto h-6 w-6 animate-spin" /></div>
        ) : (
          <div className="space-y-4 text-sm">
            <div className="grid gap-2 sm:grid-cols-2">
              <div>
                <p className="text-muted-foreground text-xs">Client</p>
                <p className="font-medium">{customer?.name ?? "—"}</p>
                {customer?.phone && <p className="text-muted-foreground">{customer.phone}</p>}
              </div>
              <div className="sm:text-right">
                <p className="text-muted-foreground text-xs">Créée le</p>
                <p>{new Date(o.created_at).toLocaleString("fr-FR")}</p>
              </div>
            </div>
            <Separator />
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Article</TableHead>
                  <TableHead className="text-right">Qté</TableHead>
                  <TableHead className="text-right">P.U.</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.length === 0 ? (
                  <TableRow><TableCell colSpan={4} className="text-muted-foreground">Aucun article enregistré</TableCell></TableRow>
                ) : items.map((it) => (
                  <TableRow key={it.id}>
                    <TableCell>{it.product_name}</TableCell>
                    <TableCell className="text-right">{it.quantity}</TableCell>
                    <TableCell className="text-right">{fmt(Number(it.unit_price))}</TableCell>
                    <TableCell className="text-right">{fmt(Number(it.total))}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <div className="space-y-1 text-right">
              <p>Sous-total : <span className="font-medium">{fmt(Number(o.subtotal))}</span></p>
              <p>Livraison : <span className="font-medium">{fmt(Number(o.shipping))}</span></p>
              <p>Remise : <span className="font-medium">-{fmt(Number(o.discount))}</span></p>
              <p className="text-base font-bold">Total : {fmt(Number(o.total))}</p>
            </div>
            <Separator />
            <div className="flex flex-wrap gap-2">
              <Badge variant={STATUS_LABELS[o.status]?.variant ?? "secondary"}>{STATUS_LABELS[o.status]?.label ?? o.status}</Badge>
              <Badge variant="outline">{PAYMENT_STATUSES.find((p) => p.value === o.payment_status)?.label ?? o.payment_status}</Badge>
              {o.payment_method && <Badge variant="outline">{PAYMENT_METHODS.find((m) => m.value === o.payment_method)?.label ?? o.payment_method}</Badge>}
              <Badge variant="outline">{CHANNELS.find((c) => c.value === o.channel)?.label ?? o.channel}</Badge>
            </div>
            <div className="space-y-1 text-xs text-muted-foreground">
              {o.confirmed_at && <p>Confirmée le {new Date(o.confirmed_at).toLocaleString("fr-FR")}</p>}
              {o.delivered_at && <p>Livrée le {new Date(o.delivered_at).toLocaleString("fr-FR")}</p>}
              {o.cancelled_at && <p>Annulée le {new Date(o.cancelled_at).toLocaleString("fr-FR")}</p>}
            </div>
            {o.notes && <p className="text-muted-foreground">Notes : {o.notes}</p>}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function OrderForm({ storeId, onDone }: { storeId: string | null; onDone: () => void }) {
  const qc = useQueryClient();
  const idempotencyKey = useRef(crypto.randomUUID());

  const [customerId, setCustomerId] = useState<string>("");
  const [customerSearch, setCustomerSearch] = useState("");
  const [newCustomerOpen, setNewCustomerOpen] = useState(false);
  const [productSearch, setProductSearch] = useState("");
  const [selectedProduct, setSelectedProduct] = useState<string>("");
  const [selectedVariant, setSelectedVariant] = useState<string>("");
  const [quantity, setQuantity] = useState(1);
  const [cart, setCart] = useState<CartLine[]>([]);
  const [shipping, setShipping] = useState(0);
  const [discount, setDiscount] = useState(0);
  const [channel, setChannel] = useState("whatsapp");
  const [paymentStatus, setPaymentStatus] = useState("unpaid");
  const [paymentMethod, setPaymentMethod] = useState("");
  const [notes, setNotes] = useState("");
  const [confirmOpen, setConfirmOpen] = useState(false);

  const customers = useQuery({
    queryKey: ["order-customers", storeId],
    enabled: !!storeId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("customers")
        .select("id, name, phone")
        .eq("store_id", storeId!)
        .order("name");
      if (error) throw error;
      return data ?? [];
    },
  });

  const products = useQuery({
    queryKey: ["order-products", storeId],
    enabled: !!storeId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("products")
        .select("id, name, price, stock, is_active, product_variants(id, name, value, price, stock, is_active)")
        .eq("store_id", storeId!)
        .order("name");
      if (error) throw error;
      return data ?? [];
    },
  });

  const filteredCustomers = (customers.data ?? []).filter((c) =>
    customerSearch ? `${c.name} ${c.phone ?? ""}`.toLowerCase().includes(customerSearch.toLowerCase()) : true,
  );
  const filteredProducts = (products.data ?? []).filter((p) =>
    productSearch ? p.name.toLowerCase().includes(productSearch.toLowerCase()) : true,
  );

  const currentProduct = (products.data ?? []).find((p) => p.id === selectedProduct);
  const variants = (currentProduct?.product_variants ?? []).filter((v) => v.is_active);
  const currentVariant = variants.find((v) => v.id === selectedVariant);
  const unitPrice = currentVariant?.price != null ? Number(currentVariant.price) : Number(currentProduct?.price ?? 0);
  const availableStock = currentVariant ? currentVariant.stock : (currentProduct?.stock ?? 0);

  const subtotal = useMemo(() => cart.reduce((s, l) => s + l.unitPrice * l.quantity, 0), [cart]);
  const total = subtotal + (Number(shipping) || 0) - (Number(discount) || 0);

  const addToCart = () => {
    if (!currentProduct) return toast.error("Sélectionnez un produit");
    if (variants.length > 0 && !currentVariant) return toast.error("Sélectionnez une variante");
    if (quantity <= 0) return toast.error("Quantité invalide");
    const key = `${currentProduct.id}:${currentVariant?.id ?? ""}`;
    const already = cart.find((l) => l.key === key)?.quantity ?? 0;
    if (already + quantity > availableStock) {
      return toast.error(
        `Stock insuffisant pour ${currentProduct.name}${currentVariant ? ` — ${currentVariant.name}: ${currentVariant.value}` : ""}. Disponible : ${availableStock}.`,
      );
    }
    setCart((prev) => {
      const existing = prev.find((l) => l.key === key);
      if (existing) return prev.map((l) => (l.key === key ? { ...l, quantity: l.quantity + quantity } : l));
      return [
        ...prev,
        {
          key,
          productId: currentProduct.id,
          variantId: currentVariant?.id ?? null,
          label: `${currentProduct.name}${currentVariant ? ` — ${currentVariant.name}: ${currentVariant.value}` : ""}`,
          unitPrice,
          stock: availableStock,
          quantity,
        },
      ];
    });
    setQuantity(1);
  };

  const mutation = useMutation({
    mutationFn: async () => {
      if (!storeId) throw new Error("Aucune boutique sélectionnée");
      if (cart.length === 0) throw new Error("Le panier est vide");
      if (shipping < 0 || discount < 0) throw new Error("Montants négatifs interdits");
      if (total < 0) throw new Error("Le total ne peut pas être négatif");
      const { data, error } = await supabase.rpc("create_order_transaction", {
        p_store_id: storeId,
        p_items: cart.map((l) => ({ product_id: l.productId, variant_id: l.variantId, quantity: l.quantity })),
        p_customer_id: customerId || undefined,
        p_channel: channel,
        p_payment_status: paymentStatus,
        p_payment_method: paymentMethod || undefined,
        p_shipping: Number(shipping) || 0,
        p_discount: Number(discount) || 0,
        p_notes: notes || undefined,
        p_idempotency_key: idempotencyKey.current,
      });
      if (error) throw error;
      return data as { order_number?: string; duplicate?: boolean } | null;
    },
    onSuccess: (data) => {
      toast.success(data?.duplicate ? `Commande déjà enregistrée (${data.order_number})` : `Commande ${data?.order_number} créée`);
      qc.invalidateQueries({ queryKey: ["orders"] });
      qc.invalidateQueries({ queryKey: ["order-products"] });
      qc.invalidateQueries({ queryKey: ["inventory-products"] });
      qc.invalidateQueries({ queryKey: ["stock-movements"] });
      qc.invalidateQueries({ queryKey: ["customers"] });
      onDone();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const createCustomer = useMutation({
    mutationFn: async (form: FormData) => {
      if (!storeId) throw new Error("Aucune boutique");
      const name = String(form.get("name") || "").trim();
      if (!name) throw new Error("Nom requis");
      const { data, error } = await supabase
        .from("customers")
        .insert({ store_id: storeId, name, phone: String(form.get("phone") || "").trim() || null })
        .select("id, name")
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      toast.success("Client créé");
      setCustomerId(data.id);
      setNewCustomerOpen(false);
      qc.invalidateQueries({ queryKey: ["order-customers"] });
      qc.invalidateQueries({ queryKey: ["customers"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-5">
      {/* CLIENT */}
      <section className="space-y-2">
        <div className="flex items-center justify-between">
          <Label>Client</Label>
          <Button type="button" variant="ghost" size="sm" onClick={() => setNewCustomerOpen(true)}>
            <UserPlus className="mr-1 h-4 w-4" /> Nouveau client
          </Button>
        </div>
        <Input placeholder="Rechercher un client..." value={customerSearch} onChange={(e) => setCustomerSearch(e.target.value)} />
        <Select value={customerId || "none"} onValueChange={(v) => setCustomerId(v === "none" ? "" : v)}>
          <SelectTrigger><SelectValue placeholder="Sélectionner un client" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="none">— Aucun client —</SelectItem>
            {filteredCustomers.map((c) => (
              <SelectItem key={c.id} value={c.id}>{c.name}{c.phone ? ` · ${c.phone}` : ""}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </section>

      <Separator />

      {/* PRODUITS */}
      <section className="space-y-2">
        <Label>Produits</Label>
        <Input placeholder="Rechercher un produit..." value={productSearch} onChange={(e) => setProductSearch(e.target.value)} />
        <div className="grid gap-2 sm:grid-cols-2">
          <Select
            value={selectedProduct}
            onValueChange={(v) => { setSelectedProduct(v); setSelectedVariant(""); }}
          >
            <SelectTrigger><SelectValue placeholder="Produit" /></SelectTrigger>
            <SelectContent>
              {filteredProducts.map((p) => (
                <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          {variants.length > 0 && (
            <Select value={selectedVariant} onValueChange={setSelectedVariant}>
              <SelectTrigger><SelectValue placeholder="Variante" /></SelectTrigger>
              <SelectContent>
                {variants.map((v) => (
                  <SelectItem key={v.id} value={v.id}>{v.name}: {v.value} · stock {v.stock}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>
        {currentProduct && (
          <div className="flex flex-wrap items-end gap-3 rounded-md border p-3">
            <div className="space-y-1">
              <Label htmlFor="qty" className="text-xs">Quantité</Label>
              <Input id="qty" type="number" min={1} className="w-24" value={quantity}
                onChange={(e) => setQuantity(Math.max(1, Number(e.target.value) || 1))} />
            </div>
            <div className="text-sm">
              <p className="text-muted-foreground text-xs">Prix unitaire</p>
              <p className="font-medium">{fmt(unitPrice)}</p>
            </div>
            <div className="text-sm">
              <p className="text-muted-foreground text-xs">Stock disponible</p>
              <p className={availableStock <= 0 ? "font-medium text-destructive" : "font-medium"}>{availableStock}</p>
            </div>
            <Button type="button" onClick={addToCart} disabled={availableStock <= 0}>
              <Plus className="mr-1 h-4 w-4" /> Ajouter
            </Button>
          </div>
        )}
      </section>

      {/* PANIER */}
      <section className="space-y-2">
        <Label>Panier</Label>
        {cart.length === 0 ? (
          <p className="rounded-md border border-dashed p-4 text-center text-sm text-muted-foreground">Aucun article</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Article</TableHead>
                <TableHead className="w-24">Qté</TableHead>
                <TableHead className="text-right">P.U.</TableHead>
                <TableHead className="text-right">Sous-total</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {cart.map((l) => (
                <TableRow key={l.key}>
                  <TableCell>{l.label}</TableCell>
                  <TableCell>
                    <Input
                      type="number"
                      min={1}
                      max={l.stock}
                      value={l.quantity}
                      className="h-8 w-20"
                      onChange={(e) => {
                        const v = Math.max(1, Number(e.target.value) || 1);
                        if (v > l.stock) {
                          toast.error(`Stock insuffisant pour ${l.label}. Disponible : ${l.stock}.`);
                          return;
                        }
                        setCart((prev) => prev.map((x) => (x.key === l.key ? { ...x, quantity: v } : x)));
                      }}
                    />
                  </TableCell>
                  <TableCell className="text-right">{fmt(l.unitPrice)}</TableCell>
                  <TableCell className="text-right">{fmt(l.unitPrice * l.quantity)}</TableCell>
                  <TableCell className="text-right">
                    <Button type="button" variant="ghost" size="icon"
                      onClick={() => setCart((prev) => prev.filter((x) => x.key !== l.key))}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </section>

      {/* RESUME */}
      <section className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="shipping">Livraison (FCFA)</Label>
          <Input id="shipping" type="number" min={0} value={shipping}
            onChange={(e) => setShipping(Math.max(0, Number(e.target.value) || 0))} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="discount">Remise (FCFA)</Label>
          <Input id="discount" type="number" min={0} value={discount}
            onChange={(e) => setDiscount(Math.max(0, Number(e.target.value) || 0))} />
        </div>
      </section>

      <div className="rounded-md bg-muted/50 p-3 text-sm space-y-1">
        <div className="flex justify-between"><span>Sous-total</span><span>{fmt(subtotal)}</span></div>
        <div className="flex justify-between"><span>Livraison</span><span>{fmt(shipping)}</span></div>
        <div className="flex justify-between"><span>Remise</span><span>-{fmt(discount)}</span></div>
        <Separator className="my-1" />
        <div className="flex justify-between text-base font-bold"><span>Total</span><span>{fmt(total)}</span></div>
      </div>

      {/* CANAL / PAIEMENT */}
      <section className="grid gap-3 sm:grid-cols-3">
        <div className="space-y-1.5">
          <Label>Canal</Label>
          <Select value={channel} onValueChange={setChannel}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {CHANNELS.map((c) => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label>Paiement</Label>
          <Select value={paymentStatus} onValueChange={setPaymentStatus}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {PAYMENT_STATUSES.map((p) => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label>Méthode</Label>
          <Select value={paymentMethod || "none"} onValueChange={(v) => setPaymentMethod(v === "none" ? "" : v)}>
            <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="none">— Non précisée —</SelectItem>
              {PAYMENT_METHODS.map((m) => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </section>
      <p className="text-xs text-muted-foreground">
        Le paiement est enregistré à titre informatif : aucun encaissement automatique n'est encore connecté.
      </p>

      <div className="space-y-1.5">
        <Label htmlFor="notes">Notes</Label>
        <Textarea id="notes" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
      </div>

      <Button
        type="button"
        variant="hero"
        className="w-full"
        disabled={mutation.isPending || cart.length === 0}
        onClick={() => setConfirmOpen(true)}
      >
        {mutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
        Créer la commande — {fmt(total)}
      </Button>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmer la commande ?</AlertDialogTitle>
            <AlertDialogDescription>
              {cart.length} article(s) — total {fmt(total)}. Le stock sera réservé immédiatement.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Retour</AlertDialogCancel>
            <AlertDialogAction disabled={mutation.isPending} onClick={() => mutation.mutate()}>
              Confirmer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={newCustomerOpen} onOpenChange={setNewCustomerOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Nouveau client</DialogTitle></DialogHeader>
          <form
            className="space-y-3"
            onSubmit={(e) => { e.preventDefault(); createCustomer.mutate(new FormData(e.currentTarget)); }}
          >
            <div className="space-y-1.5">
              <Label htmlFor="c-name">Nom</Label>
              <Input id="c-name" name="name" required />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="c-phone">Téléphone</Label>
              <Input id="c-phone" name="phone" />
            </div>
            <DialogFooter>
              <Button type="submit" disabled={createCustomer.isPending}>
                {createCustomer.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Créer
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
