import { useState } from "react";
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
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Plus, Loader2, ShoppingCart, Search } from "lucide-react";
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

export const Route = createFileRoute("/_authenticated/orders")({
  component: OrdersPage,
  head: () => ({ meta: [{ title: "Commandes — Klika.sn" }, { name: "robots", content: "noindex" }] }),
});

function OrdersPage() {
  const { data: store } = useCurrentStore();
  const qc = useQueryClient();
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);

  const orders = useQuery({
    queryKey: ["orders", store?.id],
    enabled: !!store?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("orders")
        .select("*, customer:customers(name, phone)")
        .eq("store_id", store!.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const updateStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { error } = await supabase.from("orders").update({ status: status as never }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Statut mis à jour");
      qc.invalidateQueries({ queryKey: ["orders"] });
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
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Créer une commande</DialogTitle>
            </DialogHeader>
            <OrderForm storeId={store?.id ?? null} onDone={() => setOpen(false)} />
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
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>N°</TableHead>
                  <TableHead>Client</TableHead>
                  <TableHead>Total</TableHead>
                  <TableHead>Paiement</TableHead>
                  <TableHead>Statut</TableHead>
                  <TableHead>Date</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((o) => {
                  const st = STATUS_LABELS[o.status] ?? { label: o.status, variant: "secondary" as const };
                  return (
                    <TableRow key={o.id}>
                      <TableCell className="font-medium">#{o.order_number}</TableCell>
                      <TableCell>
                        {(o as unknown as { customer?: { name?: string } | null }).customer?.name ?? "—"}
                      </TableCell>
                      <TableCell>{new Intl.NumberFormat("fr-FR").format(Number(o.total))} FCFA</TableCell>
                      <TableCell><Badge variant="outline">{o.payment_status}</Badge></TableCell>
                      <TableCell>
                        <Select value={o.status} onValueChange={(v) => updateStatus.mutate({ id: o.id, status: v })}>
                          <SelectTrigger className="w-36 h-8">
                            <SelectValue><Badge variant={st.variant}>{st.label}</Badge></SelectValue>
                          </SelectTrigger>
                          <SelectContent>
                            {Object.entries(STATUS_LABELS).map(([k, v]) => (
                              <SelectItem key={k} value={k}>{v.label}</SelectItem>
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
          )}
        </CardContent>
      </Card>
    </DashboardShell>
  );
}

function OrderForm({ storeId, onDone }: { storeId: string | null; onDone: () => void }) {
  const qc = useQueryClient();
  const customers = useQuery({
    queryKey: ["customers", storeId],
    enabled: !!storeId,
    queryFn: async () => {
      const { data } = await supabase.from("customers").select("id, name").eq("store_id", storeId!).order("name");
      return data ?? [];
    },
  });

  const mutation = useMutation({
    mutationFn: async (form: FormData) => {
      if (!storeId) throw new Error("Aucune boutique");
      const total = Number(form.get("total") || 0);
      const orderNumber = "K" + Date.now().toString().slice(-6);
      const { error } = await supabase.from("orders").insert({
        store_id: storeId,
        customer_id: String(form.get("customer_id") || "") || null,
        order_number: orderNumber,
        subtotal: total,
        total,
        channel: (form.get("channel") as never) || "whatsapp",
        notes: String(form.get("notes") || "") || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Commande créée");
      qc.invalidateQueries({ queryKey: ["orders"] });
      onDone();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <form
      className="space-y-3"
      onSubmit={(e) => {
        e.preventDefault();
        mutation.mutate(new FormData(e.currentTarget));
      }}
    >
      <div className="space-y-1.5">
        <Label htmlFor="customer_id">Client</Label>
        <select id="customer_id" name="customer_id" className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm">
          <option value="">— Aucun —</option>
          {(customers.data ?? []).map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="total">Total (FCFA)</Label>
          <Input id="total" name="total" type="number" min={0} required />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="channel">Canal</Label>
          <select id="channel" name="channel" className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm" defaultValue="whatsapp">
            <option value="whatsapp">WhatsApp</option>
            <option value="facebook">Facebook</option>
            <option value="instagram">Instagram</option>
            <option value="tiktok">TikTok</option>
            <option value="website">Site web</option>
            <option value="in_store">Boutique</option>
            <option value="other">Autre</option>
          </select>
        </div>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="notes">Notes</Label>
        <Textarea id="notes" name="notes" rows={2} />
      </div>
      <Button type="submit" variant="hero" className="w-full" disabled={mutation.isPending}>
        {mutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
        Créer la commande
      </Button>
    </form>
  );
}
