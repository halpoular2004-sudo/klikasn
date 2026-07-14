import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { CreateStoreDialog } from "@/components/dashboard/CreateStoreDialog";
import { useCurrentStore } from "@/hooks/useCurrentStore";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ShoppingCart, Package, Users, TrendingUp, Plus, Sparkles } from "lucide-react";
import { Link } from "@tanstack/react-router";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";

export const Route = createFileRoute("/_authenticated/dashboard")({
  component: DashboardPage,
  head: () => ({
    meta: [{ title: "Tableau de bord — Klika.sn" }, { name: "robots", content: "noindex" }],
  }),
});

function formatXOF(n: number) {
  return new Intl.NumberFormat("fr-FR").format(n) + " FCFA";
}

function DashboardPage() {
  const { data: store, isLoading } = useCurrentStore();
  const [openCreate, setOpenCreate] = useState(false);

  const stats = useQuery({
    queryKey: ["dashboard-stats", store?.id],
    enabled: !!store?.id,
    queryFn: async () => {
      const storeId = store!.id;
      const [orders, products, customers] = await Promise.all([
        supabase.from("orders").select("id,total,status,created_at").eq("store_id", storeId),
        supabase.from("products").select("id", { count: "exact", head: true }).eq("store_id", storeId),
        supabase.from("customers").select("id", { count: "exact", head: true }).eq("store_id", storeId),
      ]);
      const rows = orders.data ?? [];
      const revenue = rows.filter((r) => r.status !== "cancelled").reduce((s, r) => s + Number(r.total || 0), 0);
      const avgBasket = rows.length ? revenue / rows.length : 0;

      // 7-day timeline
      const days: { date: string; revenue: number; orders: number }[] = [];
      for (let i = 6; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        const key = d.toISOString().slice(0, 10);
        const label = d.toLocaleDateString("fr-FR", { weekday: "short", day: "numeric" });
        const dayRows = rows.filter((r) => r.created_at?.startsWith(key));
        days.push({
          date: label,
          revenue: dayRows.reduce((s, r) => s + Number(r.total || 0), 0),
          orders: dayRows.length,
        });
      }

      return {
        revenue,
        avgBasket,
        ordersCount: rows.length,
        productsCount: products.count ?? 0,
        customersCount: customers.count ?? 0,
        chart: days,
      };
    },
  });

  const showOnboarding = !isLoading && !store;

  return (
    <DashboardShell
      title={store?.name ?? "Tableau de bord"}
      description="Vue d'ensemble de votre activité"
      actions={
        store && (
          <Button variant="hero" size="sm" asChild>
            <Link to="/orders">
              <Plus className="mr-2 h-4 w-4" /> Nouvelle commande
            </Link>
          </Button>
        )
      }
    >
      <CreateStoreDialog open={showOnboarding || openCreate} onOpenChange={setOpenCreate} forceOpen={showOnboarding} />

      {store && (
        <div className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard icon={TrendingUp} label="Chiffre d'affaires" value={formatXOF(stats.data?.revenue ?? 0)} accent />
            <StatCard icon={ShoppingCart} label="Commandes" value={String(stats.data?.ordersCount ?? 0)} />
            <StatCard icon={Package} label="Produits" value={String(stats.data?.productsCount ?? 0)} />
            <StatCard icon={Users} label="Clients" value={String(stats.data?.customersCount ?? 0)} />
          </div>

          <div className="grid gap-4 lg:grid-cols-3">
            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle>Ventes sur 7 jours</CardTitle>
              </CardHeader>
              <CardContent className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={stats.data?.chart ?? []}>
                    <defs>
                      <linearGradient id="rev" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="var(--color-primary)" stopOpacity={0.4} />
                        <stop offset="100%" stopColor="var(--color-primary)" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                    <XAxis dataKey="date" stroke="var(--color-muted-foreground)" fontSize={12} />
                    <YAxis stroke="var(--color-muted-foreground)" fontSize={12} />
                    <Tooltip
                      contentStyle={{
                        background: "var(--color-card)",
                        border: "1px solid var(--color-border)",
                        borderRadius: 12,
                      }}
                    />
                    <Area type="monotone" dataKey="revenue" stroke="var(--color-primary)" fill="url(#rev)" strokeWidth={2} />
                  </AreaChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card className="bg-gradient-to-br from-primary to-primary-glow text-primary-foreground">
              <CardHeader>
                <div className="flex items-center gap-2">
                  <Sparkles className="h-5 w-5" />
                  <CardTitle className="text-primary-foreground">Assistant IA</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-sm text-primary-foreground/90">
                  Laissez l'IA répondre à vos clients WhatsApp, créer des commandes et générer vos rapports.
                </p>
                <Badge variant="secondary">Bientôt</Badge>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Actions rapides</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3 sm:grid-cols-3">
              <QuickAction icon={ShoppingCart} label="Créer une commande" to="/orders" />
              <QuickAction icon={Package} label="Ajouter un produit" to="/products" />
              <QuickAction icon={Users} label="Ajouter un client" to="/customers" />
            </CardContent>
          </Card>
        </div>
      )}
    </DashboardShell>
  );
}

function StatCard({ icon: Icon, label, value, accent }: { icon: React.ComponentType<{ className?: string }>; label: string; value: string; accent?: boolean }) {
  return (
    <Card className={accent ? "border-primary/30" : ""}>
      <CardContent className="p-5">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs font-medium text-muted-foreground">{label}</p>
            <p className={`mt-1 text-2xl font-bold ${accent ? "text-primary" : ""}`}>{value}</p>
          </div>
          <div className={`flex h-9 w-9 items-center justify-center rounded-lg ${accent ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"}`}>
            <Icon className="h-4 w-4" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function QuickAction({ icon: Icon, label, to }: { icon: React.ComponentType<{ className?: string }>; label: string; to: string }) {
  return (
    <Link
      to={to as never}
      className="flex items-center gap-3 rounded-xl border bg-card p-4 transition-colors hover:border-primary hover:bg-accent"
    >
      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
        <Icon className="h-5 w-5" />
      </div>
      <span className="font-medium">{label}</span>
    </Link>
  );
}
