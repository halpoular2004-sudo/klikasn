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
import { Plus, Loader2, FolderTree, Trash2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/categories")({
  component: CategoriesPage,
  head: () => ({
    meta: [
      { title: "Catégories — Klika.sn" },
      { name: "description", content: "Organisez votre catalogue par catégories sur Klika.sn." },
      { name: "robots", content: "noindex" },
    ],
  }),
});

function CategoriesPage() {
  const { data: store } = useCurrentStore();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);

  const categories = useQuery({
    queryKey: ["categories", store?.id],
    enabled: !!store?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("categories")
        .select("*, products(count)")
        .eq("store_id", store!.id)
        .order("name");
      if (error) throw error;
      return data;
    },
  });

  const create = useMutation({
    mutationFn: async (form: FormData) => {
      if (!store?.id) throw new Error("Aucune boutique");
      const { error } = await supabase.from("categories").insert({
        store_id: store.id,
        name: String(form.get("name")),
        description: String(form.get("description") || "") || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Catégorie créée");
      qc.invalidateQueries({ queryKey: ["categories"] });
      setOpen(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("categories").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Catégorie supprimée");
      qc.invalidateQueries({ queryKey: ["categories"] });
      qc.invalidateQueries({ queryKey: ["products"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <DashboardShell
      title="Catégories"
      description="Structurez votre catalogue"
      actions={
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button variant="hero" size="sm" disabled={!store}>
              <Plus className="mr-2 h-4 w-4" /> Nouvelle catégorie
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Ajouter une catégorie</DialogTitle>
            </DialogHeader>
            <form
              className="space-y-3"
              onSubmit={(e) => {
                e.preventDefault();
                create.mutate(new FormData(e.currentTarget));
              }}
            >
              <div className="space-y-1.5">
                <Label htmlFor="name">Nom</Label>
                <Input id="name" name="name" required />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="description">Description</Label>
                <Textarea id="description" name="description" rows={3} />
              </div>
              <Button type="submit" variant="hero" className="w-full" disabled={create.isPending}>
                {create.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Enregistrer
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      }
    >
      <Card>
        <CardContent className="p-4">
          {categories.isLoading ? (
            <div className="py-16 text-center text-muted-foreground">
              <Loader2 className="mx-auto h-6 w-6 animate-spin" />
            </div>
          ) : (categories.data ?? []).length === 0 ? (
            <div className="py-16 text-center">
              <FolderTree className="mx-auto h-10 w-10 text-muted-foreground" />
              <p className="mt-3 font-medium">Aucune catégorie</p>
              <p className="text-sm text-muted-foreground">Créez des catégories pour organiser vos produits.</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nom</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Produits</TableHead>
                  <TableHead className="w-10"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(categories.data ?? []).map((c) => (
                  <TableRow key={c.id}>
                    <TableCell className="font-medium">{c.name}</TableCell>
                    <TableCell className="text-muted-foreground">{c.description ?? "—"}</TableCell>
                    <TableCell>{(c.products as { count: number }[] | null)?.[0]?.count ?? 0}</TableCell>
                    <TableCell>
                      <Button variant="ghost" size="icon" onClick={() => del.mutate(c.id)}>
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
