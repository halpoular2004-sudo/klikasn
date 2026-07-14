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
import { Badge } from "@/components/ui/badge";
import { Plus, Loader2, Package, Search, Trash2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/products")({
  component: ProductsPage,
  head: () => ({ meta: [{ title: "Produits — Klika.sn" }, { name: "robots", content: "noindex" }] }),
});

function ProductsPage() {
  const { data: store } = useCurrentStore();
  const qc = useQueryClient();
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);

  const products = useQuery({
    queryKey: ["products", store?.id],
    enabled: !!store?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("products")
        .select("*")
        .eq("store_id", store!.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("products").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Produit supprimé");
      qc.invalidateQueries({ queryKey: ["products"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const filtered = (products.data ?? []).filter((p) =>
    q ? p.name.toLowerCase().includes(q.toLowerCase()) || (p.sku ?? "").toLowerCase().includes(q.toLowerCase()) : true,
  );

  return (
    <DashboardShell
      title="Produits"
      description="Gérez votre catalogue"
      actions={
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button variant="hero" size="sm" disabled={!store}>
              <Plus className="mr-2 h-4 w-4" /> Nouveau produit
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Ajouter un produit</DialogTitle>
            </DialogHeader>
            <ProductForm storeId={store?.id ?? null} onDone={() => setOpen(false)} />
          </DialogContent>
        </Dialog>
      }
    >
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center gap-2 mb-4">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input placeholder="Rechercher..." className="pl-9" value={q} onChange={(e) => setQ(e.target.value)} />
            </div>
          </div>

          {products.isLoading ? (
            <div className="py-16 text-center text-muted-foreground"><Loader2 className="mx-auto h-6 w-6 animate-spin" /></div>
          ) : filtered.length === 0 ? (
            <div className="py-16 text-center">
              <Package className="mx-auto h-10 w-10 text-muted-foreground" />
              <p className="mt-3 font-medium">Aucun produit</p>
              <p className="text-sm text-muted-foreground">Commencez par ajouter votre premier produit.</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Produit</TableHead>
                  <TableHead>SKU</TableHead>
                  <TableHead>Prix</TableHead>
                  <TableHead>Stock</TableHead>
                  <TableHead>Statut</TableHead>
                  <TableHead className="w-10"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell className="font-medium">{p.name}</TableCell>
                    <TableCell className="text-muted-foreground">{p.sku ?? "—"}</TableCell>
                    <TableCell>{new Intl.NumberFormat("fr-FR").format(Number(p.price))} FCFA</TableCell>
                    <TableCell>
                      <span className={p.stock <= p.low_stock_threshold ? "text-destructive font-medium" : ""}>
                        {p.stock}
                      </span>
                    </TableCell>
                    <TableCell>
                      <Badge variant={p.is_active ? "default" : "secondary"}>{p.is_active ? "Actif" : "Inactif"}</Badge>
                    </TableCell>
                    <TableCell>
                      <Button variant="ghost" size="icon" onClick={() => del.mutate(p.id)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </DashboardShell>
  );
}

function ProductForm({ storeId, onDone }: { storeId: string | null; onDone: () => void }) {
  const qc = useQueryClient();
  const mutation = useMutation({
    mutationFn: async (form: FormData) => {
      if (!storeId) throw new Error("Aucune boutique");
      const { error } = await supabase.from("products").insert({
        store_id: storeId,
        name: String(form.get("name")),
        sku: String(form.get("sku") || "") || null,
        price: Number(form.get("price") || 0),
        stock: Number(form.get("stock") || 0),
        description: String(form.get("description") || "") || null,
        category: String(form.get("category") || "") || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Produit créé");
      qc.invalidateQueries({ queryKey: ["products"] });
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
        <Label htmlFor="name">Nom</Label>
        <Input id="name" name="name" required />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="price">Prix (FCFA)</Label>
          <Input id="price" name="price" type="number" min={0} step="1" required />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="stock">Stock</Label>
          <Input id="stock" name="stock" type="number" min={0} step="1" defaultValue={0} />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="sku">SKU</Label>
          <Input id="sku" name="sku" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="category">Catégorie</Label>
          <Input id="category" name="category" />
        </div>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="description">Description</Label>
        <Textarea id="description" name="description" rows={3} />
      </div>
      <Button type="submit" variant="hero" className="w-full" disabled={mutation.isPending}>
        {mutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
        Enregistrer
      </Button>
    </form>
  );
}
