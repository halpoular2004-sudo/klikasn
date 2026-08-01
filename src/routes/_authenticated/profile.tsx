import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Loader2, ShieldCheck, ShieldAlert } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/profile")({
  component: ProfilePage,
  head: () => ({
    meta: [
      { title: "Mon profil — Klika.sn" },
      { name: "description", content: "Gérez vos informations personnelles et la sécurité de votre compte Klika.sn." },
      { name: "robots", content: "noindex" },
    ],
  }),
});

const ROLE_LABELS: Record<string, string> = {
  admin: "Administrateur",
  owner: "Propriétaire",
  manager: "Manager",
  staff: "Personnel",
  employee: "Employé",
  client: "Client",
};

function ProfilePage() {
  const qc = useQueryClient();

  const account = useQuery({
    queryKey: ["account"],
    queryFn: async () => {
      const { data: u } = await supabase.auth.getUser();
      const user = u.user;
      if (!user) return null;
      const [{ data: profile }, { data: roles }] = await Promise.all([
        supabase.from("profiles").select("*").eq("id", user.id).maybeSingle(),
        supabase.from("user_roles").select("role").eq("user_id", user.id),
      ]);
      return {
        email: user.email ?? "",
        emailConfirmed: Boolean(user.email_confirmed_at),
        profile,
        roles: (roles ?? []).map((r) => r.role as string),
      };
    },
  });

  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");

  useEffect(() => {
    const p = account.data?.profile;
    if (p) {
      setFullName(p.full_name ?? "");
      setPhone(p.phone ?? "");
      setAvatarUrl(p.avatar_url ?? "");
    }
  }, [account.data]);

  const saveProfile = useMutation({
    mutationFn: async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) throw new Error("Non connecté");
      const { error } = await supabase
        .from("profiles")
        .update({ full_name: fullName, phone, avatar_url: avatarUrl || null })
        .eq("id", u.user.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Profil mis à jour");
      qc.invalidateQueries({ queryKey: ["account"] });
      qc.invalidateQueries({ queryKey: ["profile"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const changePassword = useMutation({
    mutationFn: async (vars: { password: string; confirm: string }) => {
      if (vars.password !== vars.confirm) throw new Error("Les mots de passe ne correspondent pas");
      if (vars.password.length < 8) throw new Error("8 caractères minimum");
      const { error } = await supabase.auth.updateUser({ password: vars.password });
      if (error) throw error;
    },
    onSuccess: () => toast.success("Mot de passe modifié"),
    onError: (e: Error) => toast.error(e.message),
  });

  const resendVerification = useMutation({
    mutationFn: async () => {
      const email = account.data?.email;
      if (!email) throw new Error("Email introuvable");
      const { error } = await supabase.auth.resend({
        type: "signup",
        email,
        options: { emailRedirectTo: window.location.origin + "/dashboard" },
      });
      if (error) throw error;
    },
    onSuccess: () => toast.success("Email de vérification envoyé"),
    onError: (e: Error) => toast.error(e.message),
  });

  const initials = (fullName || account.data?.email || "?").slice(0, 2).toUpperCase();

  return (
    <DashboardShell title="Mon profil" description="Informations personnelles et sécurité">
      <div className="grid gap-6 lg:grid-cols-2 max-w-5xl">
        <Card>
          <CardHeader>
            <CardTitle>Informations</CardTitle>
            <CardDescription>{account.data?.email}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-4">
              <Avatar className="h-16 w-16">
                {avatarUrl && <AvatarImage src={avatarUrl} alt={fullName || "Avatar"} />}
                <AvatarFallback>{initials}</AvatarFallback>
              </Avatar>
              <div className="flex flex-wrap gap-2">
                {(account.data?.roles ?? []).map((r) => (
                  <Badge key={r} variant="secondary">
                    {ROLE_LABELS[r] ?? r}
                  </Badge>
                ))}
                {account.data?.emailConfirmed ? (
                  <Badge variant="outline" className="gap-1">
                    <ShieldCheck className="h-3 w-3" /> Email vérifié
                  </Badge>
                ) : (
                  <Badge variant="destructive" className="gap-1">
                    <ShieldAlert className="h-3 w-3" /> Email non vérifié
                  </Badge>
                )}
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="full_name">Nom complet</Label>
              <Input id="full_name" value={fullName} onChange={(e) => setFullName(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="phone">Téléphone</Label>
              <Input id="phone" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+221 77 000 00 00" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="avatar">Photo (URL)</Label>
              <Input id="avatar" value={avatarUrl} onChange={(e) => setAvatarUrl(e.target.value)} placeholder="https://..." />
            </div>

            <div className="flex flex-wrap gap-2">
              <Button variant="hero" onClick={() => saveProfile.mutate()} disabled={saveProfile.isPending}>
                {saveProfile.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Enregistrer
              </Button>
              {!account.data?.emailConfirmed && (
                <Button variant="outline" onClick={() => resendVerification.mutate()} disabled={resendVerification.isPending}>
                  {resendVerification.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Renvoyer la vérification
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Sécurité</CardTitle>
            <CardDescription>Changez votre mot de passe</CardDescription>
          </CardHeader>
          <CardContent>
            <form
              className="space-y-3"
              onSubmit={(e) => {
                e.preventDefault();
                const form = new FormData(e.currentTarget);
                changePassword.mutate({
                  password: String(form.get("password")),
                  confirm: String(form.get("confirm")),
                });
                e.currentTarget.reset();
              }}
            >
              <div className="space-y-1.5">
                <Label htmlFor="new_password">Nouveau mot de passe</Label>
                <Input id="new_password" name="password" type="password" required minLength={8} autoComplete="new-password" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="confirm_password">Confirmer</Label>
                <Input id="confirm_password" name="confirm" type="password" required minLength={8} autoComplete="new-password" />
              </div>
              <Button type="submit" variant="hero" disabled={changePassword.isPending}>
                {changePassword.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Modifier le mot de passe
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </DashboardShell>
  );
}
