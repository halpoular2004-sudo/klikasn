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
import { Plus, Loader2, Package, Search, Trash2, Layers, Pencil } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/products")({
  component: ProductsPage,
  head: () => ({
    meta: [
      { title: "Produits — Klika.sn" },
      { name: "description", content: "Gérez votre catalogue, vos catégories et vos variantes sur Klika.sn." },
      { name: "robots", content: "noindex" },
    ],
  }),
});

type ProductRow = {
  id: string;
  name: string;
  sku: string | null;
  price: number;
  stock: number;
  unit: string;
  barcode: string | null;
  description: string | null;
  category_id: string | null;
  low_stock_threshold: number;
  is_active: boolean;
  status: "draft" | "published" | "archived";
  categories: { name: string } | null;
  product_variants: { id: string }[] | null;
};

const NO_CATEGORY = "__none__";

const statusMeta: Record<string, { label: string; variant: "default" | "secondary" | "outline" }> = {
  published: { label: "Publié", variant: "default" },
  draft: { label: "Brouillon", variant: "secondary" },
  archived: { label: "Archivé", variant: "outline" },
};


function ProductsPage() {
  const { data: store } = useCurrentStore();
  const qc = useQueryClient();
  const [q, setQ] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<ProductRow | null>(null);
  const [variantsFor, setVariantsFor] = useState<ProductRow | null>(null);

  const categories = useQuery({
    queryKey: ["categories", store?.id],
    enabled: !!store?.id,
    queryFn: async () => {
      const { data, error } = await supabase.from("categories").select("id, name").eq("store_id", store!.id).order("name");
      if (error) throw error;
      return data;
    },
  });

  const products = useQuery({
    queryKey: ["products", store?.id],
    enabled: !!store?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("products")
        .select("*, categories(name), product_variants(id)")
        .eq("store_id", store!.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as unknown as ProductRow[];
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
      qc.invalidateQueries({ queryKey: ["inventory-products"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const filtered = (products.data ?? []).filter((p) => {
    const matchQ = q
      ? p.name.toLowerCase().includes(q.toLowerCase()) ||
        (p.sku ?? "").toLowerCase().includes(q.toLowerCase()) ||
        (p.barcode ?? "").toLowerCase().includes(q.toLowerCase())
      : true;
    const matchCat = categoryFilter === "all" ? true : categoryFilter === NO_CATEGORY ? !p.category_id : p.category_id === categoryFilter;
    return matchQ && matchCat;
  });

  return (
    <DashboardShell
      title="Produits"
      description="Catalogue, catégories et variantes"
      actions={
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button variant="hero" size="sm" disabled={!store}>
              <Plus className="mr-2 h-4 w-4" /> Nouveau produit
            </Button>
          </DialogTrigger>
          <DialogContent className="max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Ajouter un produit</DialogTitle>
            </DialogHeader>
            <ProductForm
              storeId={store?.id ?? null}
              categories={categories.data ?? []}
              onDone={() => setOpen(false)}
            />
          </DialogContent>
        </Dialog>
      }
    >
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 mb-4">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input placeholder="Nom, SKU, code-barres..." className="pl-9" value={q} onChange={(e) => setQ(e.target.value)} />
            </div>
            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger className="sm:w-56"><SelectValue placeholder="Catégorie" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Toutes les catégories</SelectItem>
                <SelectItem value={NO_CATEGORY}>Sans catégorie</SelectItem>
                {(categories.data ?? []).map((c) => (
                  <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
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
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Produit</TableHead>
                    <TableHead>Catégorie</TableHead>
                    <TableHead>SKU</TableHead>
                    <TableHead>Prix</TableHead>
                    <TableHead>Stock</TableHead>
                    <TableHead>Variantes</TableHead>
                    <TableHead>Statut</TableHead>
                    <TableHead className="w-28"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((p) => (
                    <TableRow key={p.id}>
                      <TableCell className="font-medium">{p.name}</TableCell>
                      <TableCell className="text-muted-foreground">{p.categories?.name ?? "—"}</TableCell>
                      <TableCell className="text-muted-foreground">{p.sku ?? "—"}</TableCell>
                      <TableCell>{new Intl.NumberFormat("fr-FR").format(Number(p.price))} FCFA</TableCell>
                      <TableCell>
                        <span className={p.stock <= p.low_stock_threshold ? "text-destructive font-medium" : ""}>
                          {p.stock} {p.unit}
                        </span>
                      </TableCell>
                      <TableCell>
                        <Button variant="ghost" size="sm" onClick={() => setVariantsFor(p)}>
                          <Layers className="mr-1.5 h-3.5 w-3.5" /> {(p.product_variants ?? []).length}
                        </Button>
                      </TableCell>
                      <TableCell>
                        <Badge variant={p.is_active ? "default" : "secondary"}>{p.is_active ? "Actif" : "Inactif"}</Badge>
                      </TableCell>
                      <TableCell className="whitespace-nowrap">
                        <Button variant="ghost" size="icon" onClick={() => setEditing(p)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => del.mutate(p.id)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Modifier le produit</DialogTitle>
          </DialogHeader>
          {editing && (
            <ProductForm
              storeId={store?.id ?? null}
              categories={categories.data ?? []}
              product={editing}
              onDone={() => setEditing(null)}
            />
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={!!variantsFor} onOpenChange={(o) => !o && setVariantsFor(null)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Variantes — {variantsFor?.name}</DialogTitle>
          </DialogHeader>
          {variantsFor && <VariantsManager productId={variantsFor.id} />}
        </DialogContent>
      </Dialog>
    </DashboardShell>
  );
}

function ProductForm({
  storeId,
  categories,
  product,
  onDone,
}: {
  storeId: string | null;
  categories: { id: string; name: string }[];
  product?: ProductRow;
  onDone: () => void;
}) {
  const qc = useQueryClient();
  const [categoryId, setCategoryId] = useState(product?.category_id ?? NO_CATEGORY);

  const mutation = useMutation({
    mutationFn: async (form: FormData) => {
      if (!storeId) throw new Error("Aucune boutique");
      const payload = {
        name: String(form.get("name")),
        sku: String(form.get("sku") || "") || null,
        barcode: String(form.get("barcode") || "") || null,
        unit: String(form.get("unit") || "unité") || "unité",
        price: Number(form.get("price") || 0),
        stock: Number(form.get("stock") || 0),
        low_stock_threshold: Number(form.get("low_stock_threshold") || 5),
        description: String(form.get("description") || "") || null,
        category_id: categoryId === NO_CATEGORY ? null : categoryId,
      };
      if (product) {
        const { error } = await supabase.from("products").update(payload).eq("id", product.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("products").insert({ ...payload, store_id: storeId });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success(product ? "Produit mis à jour" : "Produit créé");
      qc.invalidateQueries({ queryKey: ["products"] });
      qc.invalidateQueries({ queryKey: ["inventory-products"] });
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
        <Input id="name" name="name" defaultValue={product?.name} required />
      </div>
      <div className="space-y-1.5">
        <Label>Catégorie</Label>
        <Select value={categoryId} onValueChange={setCategoryId}>
          <SelectTrigger><SelectValue placeholder="Sans catégorie" /></SelectTrigger>
          <SelectContent>
            <SelectItem value={NO_CATEGORY}>Sans catégorie</SelectItem>
            {categories.map((c) => (
              <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="price">Prix (FCFA)</Label>
          <Input id="price" name="price" type="number" min={0} step="1" defaultValue={product?.price ?? ""} required />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="stock">Stock</Label>
          <Input id="stock" name="stock" type="number" min={0} step="1" defaultValue={product?.stock ?? 0} />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="low_stock_threshold">Seuil d'alerte</Label>
          <Input id="low_stock_threshold" name="low_stock_threshold" type="number" min={0} step="1" defaultValue={product?.low_stock_threshold ?? 5} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="unit">Unité</Label>
          <Input id="unit" name="unit" defaultValue={product?.unit ?? "unité"} />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="sku">SKU</Label>
          <Input id="sku" name="sku" defaultValue={product?.sku ?? ""} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="barcode">Code-barres</Label>
          <Input id="barcode" name="barcode" defaultValue={product?.barcode ?? ""} />
        </div>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="description">Description</Label>
        <Textarea id="description" name="description" rows={3} defaultValue={product?.description ?? ""} />
      </div>
      <Button type="submit" variant="hero" className="w-full" disabled={mutation.isPending}>
        {mutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
        Enregistrer
      </Button>
    </form>
  );
}

function VariantsManager({ productId }: { productId: string }) {
  const qc = useQueryClient();

  const variants = useQuery({
    queryKey: ["variants", productId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("product_variants")
        .select("*")
        .eq("product_id", productId)
        .order("created_at");
      if (error) throw error;
      return data;
    },
  });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["variants", productId] });
    qc.invalidateQueries({ queryKey: ["products"] });
    qc.invalidateQueries({ queryKey: ["inventory-products"] });
  };

  const add = useMutation({
    mutationFn: async (form: FormData) => {
      const { error } = await supabase.from("product_variants").insert({
        product_id: productId,
        name: String(form.get("vname")),
        value: String(form.get("vvalue")),
        sku: String(form.get("vsku") || "") || null,
        price: form.get("vprice") ? Number(form.get("vprice")) : null,
        stock: Number(form.get("vstock") || 0),
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Variante ajoutée");
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("product_variants").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Variante supprimée");
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-4">
      {variants.isLoading ? (
        <div className="py-6 text-center"><Loader2 className="mx-auto h-5 w-5 animate-spin text-muted-foreground" /></div>
      ) : (variants.data ?? []).length === 0 ? (
        <p className="text-sm text-muted-foreground">Aucune variante. Ajoutez par exemple « Taille : M » ou « Couleur : Rouge ».</p>
      ) : (
        <div className="space-y-2">
          {(variants.data ?? []).map((v) => (
            <div key={v.id} className="flex items-center justify-between rounded-lg border p-2.5 text-sm">
              <div>
                <p className="font-medium">{v.name} : {v.value}</p>
                <p className="text-xs text-muted-foreground">
                  {v.sku ? `${v.sku} · ` : ""}
                  {v.price != null ? `${new Intl.NumberFormat("fr-FR").format(Number(v.price))} FCFA · ` : ""}
                  Stock {v.stock}
                </p>
              </div>
              <Button variant="ghost" size="icon" onClick={() => del.mutate(v.id)}>
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </div>
      )}

      <form
        className="space-y-3 border-t pt-4"
        onSubmit={(e) => {
          e.preventDefault();
          const el = e.currentTarget;
          add.mutate(new FormData(el), { onSuccess: () => el.reset() });
        }}
      >
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="vname">Option</Label>
            <Input id="vname" name="vname" placeholder="Taille" required />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="vvalue">Valeur</Label>
            <Input id="vvalue" name="vvalue" placeholder="M" required />
          </div>
        </div>
        <div className="grid grid-cols-3 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="vsku">SKU</Label>
            <Input id="vsku" name="vsku" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="vprice">Prix</Label>
            <Input id="vprice" name="vprice" type="number" min={0} step="1" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="vstock">Stock</Label>
            <Input id="vstock" name="vstock" type="number" min={0} step="1" defaultValue={0} />
          </div>
        </div>
        <Button type="submit" variant="outline" className="w-full" disabled={add.isPending}>
          {add.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Ajouter la variante
        </Button>
      </form>
    </div>
  );
}
