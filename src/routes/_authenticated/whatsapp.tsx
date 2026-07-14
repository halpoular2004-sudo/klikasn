import { createFileRoute } from "@tanstack/react-router";
import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { Card, CardContent } from "@/components/ui/card";
import { MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/whatsapp")({
  component: WhatsappPage,
  head: () => ({ meta: [{ title: "WhatsApp — Klika.sn" }, { name: "robots", content: "noindex" }] }),
});

function WhatsappPage() {
  return (
    <DashboardShell title="WhatsApp" description="Connectez votre WhatsApp et automatisez vos ventes">
      <Card>
        <CardContent className="p-10 text-center space-y-4">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-success/10 text-success">
            <MessageCircle className="h-8 w-8" />
          </div>
          <div>
            <h2 className="text-xl font-semibold">Bientôt disponible</h2>
            <p className="text-sm text-muted-foreground max-w-md mx-auto mt-2">
              Connectez votre compte WhatsApp Business pour recevoir vos messages, créer automatiquement vos commandes et envoyer des relances.
            </p>
          </div>
          <Button variant="hero" disabled>Se connecter à WhatsApp</Button>
        </CardContent>
      </Card>
    </DashboardShell>
  );
}
