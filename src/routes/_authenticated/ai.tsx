import { createFileRoute } from "@tanstack/react-router";
import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { Card, CardContent } from "@/components/ui/card";
import { Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/ai")({
  component: AiPage,
  head: () => ({ meta: [{ title: "Assistant IA — Klika.sn" }, { name: "robots", content: "noindex" }] }),
});

function AiPage() {
  return (
    <DashboardShell title="Assistant IA" description="Automatisez la relation client avec l'IA">
      <Card>
        <CardContent className="p-10 text-center space-y-4">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <Sparkles className="h-8 w-8" />
          </div>
          <div>
            <h2 className="text-xl font-semibold">Assistant IA — Bientôt</h2>
            <p className="text-sm text-muted-foreground max-w-md mx-auto mt-2">
              Réponses automatiques, création de commandes depuis vos conversations, résumés, recommandations et analyses.
            </p>
          </div>
          <Button variant="hero" disabled>Activer l'IA</Button>
        </CardContent>
      </Card>
    </DashboardShell>
  );
}
