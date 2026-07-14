import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Store, Loader2 } from "lucide-react";
import { toast } from "sonner";

export function CreateStoreDialog({ open, onOpenChange, forceOpen = false }: { open: boolean; onOpenChange: (v: boolean) => void; forceOpen?: boolean }) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const qc = useQueryClient();

  const mutation = useMutation({
    mutationFn: async () => {
      const { data: userData } = await supabase.auth.getUser();
      const user = userData.user;
      if (!user) throw new Error("Non connecté");
      const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "") + "-" + Math.random().toString(36).slice(2, 6);
      const { error } = await supabase.from("stores").insert({
        owner_id: user.id,
        name,
        description,
        whatsapp_number: whatsapp,
        slug,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Boutique créée !");
      qc.invalidateQueries({ queryKey: ["current-store"] });
      onOpenChange(false);
      setName(""); setDescription(""); setWhatsapp("");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={forceOpen ? () => {} : onOpenChange}>
      <DialogContent className="sm:max-w-md" onInteractOutside={forceOpen ? (e) => e.preventDefault() : undefined}>
        <DialogHeader>
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <Store className="h-6 w-6" />
          </div>
          <DialogTitle className="text-center">Créez votre boutique</DialogTitle>
          <DialogDescription className="text-center">
            Configurez votre espace de vente en quelques secondes.
          </DialogDescription>
        </DialogHeader>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            mutation.mutate();
          }}
          className="space-y-3"
        >
          <div className="space-y-1.5">
            <Label htmlFor="store-name">Nom de la boutique</Label>
            <Input id="store-name" value={name} onChange={(e) => setName(e.target.value)} required placeholder="Ma boutique Sénégal" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="store-wa">Numéro WhatsApp</Label>
            <Input id="store-wa" value={whatsapp} onChange={(e) => setWhatsapp(e.target.value)} placeholder="+221 77 000 00 00" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="store-desc">Description</Label>
            <Textarea id="store-desc" value={description} onChange={(e) => setDescription(e.target.value)} rows={3} placeholder="Que vendez-vous ?" />
          </div>
          <Button type="submit" variant="hero" className="w-full" disabled={mutation.isPending || !name}>
            {mutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Créer ma boutique
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
