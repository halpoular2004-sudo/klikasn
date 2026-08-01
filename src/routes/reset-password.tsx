import { useEffect, useState } from "react";
import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { Zap, Loader2 } from "lucide-react";

export const Route = createFileRoute("/reset-password")({
  ssr: false,
  component: ResetPasswordPage,
  head: () => ({
    meta: [
      { title: "Nouveau mot de passe — Klika.sn" },
      { name: "description", content: "Définissez un nouveau mot de passe pour votre compte Klika.sn." },
      { name: "robots", content: "noindex" },
    ],
  }),
});

function ResetPasswordPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const hash = window.location.hash;
    const isRecovery = hash.includes("type=recovery");
    const { data } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "PASSWORD_RECOVERY" || (session && isRecovery)) setReady(true);
    });
    supabase.auth.getSession().then(({ data: s }) => {
      if (s.session) setReady(true);
    });
    return () => data.subscription.unsubscribe();
  }, []);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const password = String(form.get("password"));
    const confirm = String(form.get("confirm"));
    if (password !== confirm) {
      toast.error("Les mots de passe ne correspondent pas");
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password });
    setLoading(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Mot de passe mis à jour");
    navigate({ to: "/dashboard", replace: true });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-accent flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-md">
        <Link to="/" className="mb-6 flex items-center justify-center gap-2 font-extrabold text-xl">
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-primary to-primary-glow text-primary-foreground">
            <Zap className="h-5 w-5" />
          </span>
          Klika<span className="text-primary">.sn</span>
        </Link>

        <Card className="glass shadow-elegant">
          <CardHeader>
            <CardTitle>Nouveau mot de passe</CardTitle>
            <CardDescription>
              {ready
                ? "Choisissez un mot de passe d'au moins 8 caractères."
                : "Ouvrez cette page depuis le lien reçu par email pour continuer."}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-3">
              <div className="space-y-1.5">
                <Label htmlFor="password">Mot de passe</Label>
                <Input id="password" name="password" type="password" required minLength={8} autoComplete="new-password" disabled={!ready} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="confirm">Confirmer</Label>
                <Input id="confirm" name="confirm" type="password" required minLength={8} autoComplete="new-password" disabled={!ready} />
              </div>
              <Button type="submit" variant="hero" className="w-full" disabled={loading || !ready}>
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Mettre à jour
              </Button>
              <Button type="button" variant="ghost" className="w-full" asChild>
                <Link to="/auth">Retour à la connexion</Link>
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
