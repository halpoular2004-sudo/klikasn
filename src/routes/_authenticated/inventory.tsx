import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { useCurrentStore } from "@/hooks/useCurrentStore";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, AlertTriangle, ArrowDownUp, Boxes } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/inventory")({
  component: InventoryPage,
  head: () => ({
    meta: [
      { title: "Stocks — Klika.sn" },
      { name: "description", content: "Suivi des stocks, alertes et mouvements d'inventaire sur Klika.sn." },
      { name: "robots", content: "noindex" },
    ],
  }),
});

type MovementTarget = { productId: string; variantId: string | null; label: string; stock: number };

const typeLabels: Record<string, string> = {
  in: "Entrée",
  out: "Sortie",
  adjustment: "Ajustement",
  sale: "Vente",
  return: "Retour",
};

function InventoryPage() {
  const { data: store } = useCurrentStore();
  const qc = useQueryClient();
  const [target, setTarget] = useState<MovementTarget | null>(null);

  const products = useQuery({
    queryKey: ["inventory-products", store?.id],
    enabled: !!store?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("products")
        .select("id, name, sku, unit, stock, low_stock_threshold, product_variants(id, name, value, sku, stock)")
        .eq("store_id", store!.id)
        .order("name");
      if (error) throw error;
      return data;
    },
  });

  const movements = useQuery({
    queryKey: ["stock-movements", store?.id],
    enabled: !!store?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("stock_movements")
        .select("*, products(name), product_variants(name, value)")
        .eq("store_id", store!.id)
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      return data;
    },
  });

  const move = useMutation({
    mutationFn: async (form: FormData) => {
      if (!store?.id || !target) throw new Error("Aucune sélection");
      const type = String(form.get("type"));
      const qty = Number(form.get("quantity") || 0);
      if (!qty) throw new Error("Quantité invalide");
      const delta = type === "adjustment" ? qty - target.stock : type === "in" || type === "return" ? qty : -qty;
      const newStock = Math.max(0, target.stock + delta);

      if (target.variantId) {
        const { error } = await supabase.from("product_variants").update({ stock: newStock }).eq("id", target.variantId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("products").update({ stock: newStock }).eq("id", target.productId);
        if (error) throw error;
      }

      const { data: userData } = await supabase.auth.getUser();
      const { error: mErr } = await supabase.from("stock_movements").insert({
        store_id: store.id,
        product_id: target.productId,
        variant_id: target.variantId,
        type: type as "in" | "out" | "adjustment" | "sale" | "return",
        quantity: delta,
        reason: String(form.get("reason") || "") || null,
        created_by: userData.user?.id ?? null,
      });
      if (mErr) throw mErr;
    },
    onSuccess: () => {
      toast.success("Stock mis à jour");
      qc.invalidateQueries({ queryKey: ["inventory-products"] });
      qc.invalidateQueries({ queryKey: ["stock-movements"] });
      qc.invalidateQueries({ queryKey: ["products"] });
      setTarget(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const rows = (products.data ?? []).flatMap((p) => {
    const variants = (p.product_variants ?? []) as { id: string; name: string; value: string; sku: string | null; stock: number }[];
    const base = [{ productId: p.id, variantId: null as string | null, label: p.name, sku: p.sku, stock: p.stock, threshold: p.low_stock_threshold, unit: p.unit }];
    return base.concat(
      variants.map((v) => ({
        productId: p.id,
        variantId: v.id,
        label: `${p.name} — ${v.name}: ${v.value}`,
        sku: v.sku,
        stock: v.stock,
        threshold: p.low_stock_threshold,
        unit: p.unit,
      })),
    );
  });

  const lowStock = rows.filter((r) => r.stock <= r.threshold);

  return (
    <DashboardShell title="Stocks" description="Inventaire, alertes et mouvements">
      <div className="grid gap-4 md:grid-cols-3 mb-4">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Références suivies</CardTitle></CardHeader>
          <CardContent className="text-2xl font-bold">{rows.length}</CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Unités en stock</CardTitle></CardHeader>
          <CardContent className="text-2xl font-bold">{rows.reduce((s, r) => s + r.stock, 0)}</CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Alertes stock bas</CardTitle></CardHeader>
          <CardContent className="text-2xl font-bold text-destructive">{lowStock.length}</CardContent>
        </Card>
      </div>

      <Tabs defaultValue="stock">
        <TabsList>
          <TabsTrigger value="stock">Inventaire</TabsTrigger>
          <TabsTrigger value="alerts">Alertes ({lowStock.length})</TabsTrigger>
          <TabsTrigger value="history">Mouvements</TabsTrigger>
        </TabsList>

        <TabsContent value="stock">
          <Card>
            <CardContent className="p-4">
              {products.isLoading ? (
                <div className="py-16 text-center"><Loader2 className="mx-auto h-6 w-6 animate-spin text-muted-foreground" /></div>
              ) : rows.length === 0 ? (
                <div className="py-16 text-center">
                  <Boxes className="mx-auto h-10 w-10 text-muted-foreground" />
                  <p className="mt-3 font-medium">Aucun produit en stock</p>
                </div>
              ) : (
                <StockTable rows={rows} onMove={setTarget} />
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="alerts">
          <Card>
            <CardContent className="p-4">
              {lowStock.length === 0 ? (
                <div className="py-16 text-center">
                  <AlertTriangle className="mx-auto h-10 w-10 text-muted-foreground" />
                  <p className="mt-3 font-medium">Aucune alerte</p>
                  <p className="text-sm text-muted-foreground">Tous vos stocks sont au-dessus du seuil.</p>
                </div>
              ) : (
                <StockTable rows={lowStock} onMove={setTarget} />
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="history">
          <Card>
            <CardContent className="p-4">
              {(movements.data ?? []).length === 0 ? (
                <div className="py-16 text-center">
                  <ArrowDownUp className="mx-auto h-10 w-10 text-muted-foreground" />
                  <p className="mt-3 font-medium">Aucun mouvement enregistré</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Produit</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Quantité</TableHead>
                      <TableHead>Motif</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(movements.data ?? []).map((m) => {
                      const v = m.product_variants as { name: string; value: string } | null;
                      return (
                        <TableRow key={m.id}>
                          <TableCell className="text-muted-foreground">{new Date(m.created_at).toLocaleString("fr-FR")}</TableCell>
                          <TableCell className="font-medium">
                            {(m.products as { name: string } | null)?.name ?? "—"}
                            {v ? ` — ${v.name}: ${v.value}` : ""}
                          </TableCell>
                          <TableCell><Badge variant="secondary">{typeLabels[m.type] ?? m.type}</Badge></TableCell>
                          <TableCell className={m.quantity < 0 ? "text-destructive" : "text-primary"}>
                            {m.quantity > 0 ? `+${m.quantity}` : m.quantity}
                          </TableCell>
                          <TableCell className="text-muted-foreground">{m.reason ?? "—"}</TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={!!target} onOpenChange={(o) => !o && setTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Mouvement de stock</DialogTitle>
          </DialogHeader>
          <form
            className="space-y-3"
            onSubmit={(e) => {
              e.preventDefault();
              move.mutate(new FormData(e.currentTarget));
            }}
          >
            <p className="text-sm text-muted-foreground">
              {target?.label} — stock actuel : <span className="font-medium text-foreground">{target?.stock}</span>
            </p>
            <div className="space-y-1.5">
              <Label htmlFor="type">Type</Label>
              <Select name="type" defaultValue="in">
                <SelectTrigger id="type"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="in">Entrée (réapprovisionnement)</SelectItem>
                  <SelectItem value="out">Sortie (perte, casse)</SelectItem>
                  <SelectItem value="return">Retour client</SelectItem>
                  <SelectItem value="adjustment">Ajustement (stock final)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="quantity">Quantité</Label>
              <Input id="quantity" name="quantity" type="number" min={0} step="1" required />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="reason">Motif</Label>
              <Input id="reason" name="reason" placeholder="Optionnel" />
            </div>
            <Button type="submit" variant="hero" className="w-full" disabled={move.isPending}>
              {move.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Valider le mouvement
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </DashboardShell>
  );
}

function StockTable({
  rows,
  onMove,
}: {
  rows: { productId: string; variantId: string | null; label: string; sku: string | null; stock: number; threshold: number; unit: string }[];
  onMove: (t: MovementTarget) => void;
}) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Référence</TableHead>
          <TableHead>SKU</TableHead>
          <TableHead>Stock</TableHead>
          <TableHead>Seuil</TableHead>
          <TableHead className="w-32"></TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((r) => (
          <TableRow key={`${r.productId}-${r.variantId ?? "base"}`}>
            <TableCell className="font-medium">{r.label}</TableCell>
            <TableCell className="text-muted-foreground">{r.sku ?? "—"}</TableCell>
            <TableCell>
              <span className={r.stock <= r.threshold ? "text-destructive font-semibold" : ""}>
                {r.stock} {r.unit}
              </span>
            </TableCell>
            <TableCell className="text-muted-foreground">{r.threshold}</TableCell>
            <TableCell>
              <Button
                variant="outline"
                size="sm"
                onClick={() => onMove({ productId: r.productId, variantId: r.variantId, label: r.label, stock: r.stock })}
              >
                <ArrowDownUp className="mr-2 h-3.5 w-3.5" /> Ajuster
              </Button>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
