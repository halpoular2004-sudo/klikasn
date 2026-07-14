import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { useCurrentStore } from "@/hooks/useCurrentStore";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";

export const Route = createFileRoute("/_authenticated/reports")({
  component: ReportsPage,
  head: () => ({ meta: [{ title: "Rapports — Klika.sn" }, { name: "robots", content: "noindex" }] }),
});

const COLORS = ["var(--color-primary)", "var(--color-primary-glow)", "var(--color-success)", "var(--color-chart-4)", "var(--color-chart-5)"];

function ReportsPage() {
  const { data: store } = useCurrentStore();

  const data = useQuery({
    queryKey: ["reports", store?.id],
    enabled: !!store?.id,
    queryFn: async () => {
      const { data: orders } = await supabase
        .from("orders")
        .select("total, status, channel, created_at")
        .eq("store_id", store!.id);
      const rows = orders ?? [];

      const byMonth: Record<string, number> = {};
      const byChannel: Record<string, number> = {};
      for (const r of rows) {
        const key = new Date(r.created_at).toLocaleDateString("fr-FR", { month: "short" });
        byMonth[key] = (byMonth[key] ?? 0) + Number(r.total || 0);
        byChannel[r.channel] = (byChannel[r.channel] ?? 0) + 1;
      }
      return {
        months: Object.entries(byMonth).map(([month, revenue]) => ({ month, revenue })),
        channels: Object.entries(byChannel).map(([name, value]) => ({ name, value })),
      };
    },
  });

  return (
    <DashboardShell title="Rapports" description="Analysez la performance de votre boutique">
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>Revenus mensuels</CardTitle></CardHeader>
          <CardContent className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.data?.months ?? []}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                <XAxis dataKey="month" fontSize={12} stroke="var(--color-muted-foreground)" />
                <YAxis fontSize={12} stroke="var(--color-muted-foreground)" />
                <Tooltip contentStyle={{ background: "var(--color-card)", border: "1px solid var(--color-border)", borderRadius: 12 }} />
                <Bar dataKey="revenue" fill="var(--color-primary)" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Répartition par canal</CardTitle></CardHeader>
          <CardContent className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={data.data?.channels ?? []} dataKey="value" nameKey="name" innerRadius={60} outerRadius={100} paddingAngle={4}>
                  {(data.data?.channels ?? []).map((_, i) => (
                    <Cell key={i} fill={COLORS[i % COLORS.length]} />
                  ))}
                </Pie>
                <Legend />
                <Tooltip contentStyle={{ background: "var(--color-card)", border: "1px solid var(--color-border)", borderRadius: 12 }} />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>
    </DashboardShell>
  );
}
