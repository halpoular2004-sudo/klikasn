import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { useCurrentStore } from "@/hooks/useCurrentStore";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/settings")({
  component: SettingsPage,
  head: () => ({ meta: [{ title: "Paramètres — Klika.sn" }, { name: "robots", content: "noindex" }] }),
});

function SettingsPage() {
  const qc = useQueryClient();
  const { data: store } = useCurrentStore();

  const profile = useQuery({
    queryKey: ["profile"],
    queryFn: async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) return null;
      const { data } = await supabase.from("profiles").select("*").eq("id", u.user.id).maybeSingle();
      return { ...data, email: u.user.email };
    },
  });

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [storeName, setStoreName] = useState("");
  const [storeWa, setStoreWa] = useState("");
  const [storeDesc, setStoreDesc] = useState("");

  useEffect(() => {
    if (profile.data) {
      setName(profile.data.full_name ?? "");
      setPhone(profile.data.phone ?? "");
    }
  }, [profile.data]);

  useEffect(() => {
    if (store) {
      setStoreName(store.name);
      setStoreWa(store.whatsapp_number ?? "");
      setStoreDesc(store.description ?? "");
    }
  }, [store]);

  const saveProfile = useMutation({
    mutationFn: async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) throw new Error("Non connecté");
      const { error } = await supabase.from("profiles").update({ full_name: name, phone }).eq("id", u.user.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Profil mis à jour");
      qc.invalidateQueries({ queryKey: ["profile"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const saveStore = useMutation({
    mutationFn: async () => {
      if (!store) throw new Error("Aucune boutique");
      const { error } = await supabase
        .from("stores")
        .update({ name: storeName, whatsapp_number: storeWa, description: storeDesc })
        .eq("id", store.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Boutique mise à jour");
      qc.invalidateQueries({ queryKey: ["current-store"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <DashboardShell title="Paramètres" description="Gérez votre compte et votre boutique">
      <div className="grid gap-6 lg:grid-cols-2 max-w-5xl">
        <Card>
          <CardHeader>
            <CardTitle>Mon profil</CardTitle>
            <CardDescription>{profile.data?.email}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-1.5">
              <Label>Nom complet</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Téléphone</Label>
              <Input value={phone} onChange={(e) => setPhone(e.target.value)} />
            </div>
            <Button variant="hero" onClick={() => saveProfile.mutate()} disabled={saveProfile.isPending}>
              {saveProfile.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Enregistrer
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Ma boutique</CardTitle>
            <CardDescription>Informations affichées à vos clients</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-1.5">
              <Label>Nom</Label>
              <Input value={storeName} onChange={(e) => setStoreName(e.target.value)} disabled={!store} />
            </div>
            <div className="space-y-1.5">
              <Label>WhatsApp</Label>
              <Input value={storeWa} onChange={(e) => setStoreWa(e.target.value)} disabled={!store} />
            </div>
            <div className="space-y-1.5">
              <Label>Description</Label>
              <Textarea value={storeDesc} onChange={(e) => setStoreDesc(e.target.value)} rows={3} disabled={!store} />
            </div>
            <Button variant="hero" onClick={() => saveStore.mutate()} disabled={saveStore.isPending || !store}>
              {saveStore.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Enregistrer
            </Button>
          </CardContent>
        </Card>
      </div>
    </DashboardShell>
  );
}
