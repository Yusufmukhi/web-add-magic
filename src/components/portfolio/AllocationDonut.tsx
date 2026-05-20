import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from "recharts";

const COLORS = [
  "#6366f1", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6",
  "#06b6d4", "#ec4899", "#84cc16", "#f97316", "#14b8a6",
];

interface Props {
  title: string;
  data: Array<{ name: string; value: number }>;
}

export function AllocationDonut({ title, data }: Props) {
  return (
    <div className="rounded-2xl border border-border bg-card p-4 creative:gradient-card creative:shadow-soft minimal:rounded-none minimal:border-x-0 minimal:bg-transparent">
      <h3 className="mb-3 font-display text-sm font-semibold">{title}</h3>
      {data.length === 0 ? (
        <div className="grid h-56 place-items-center text-xs text-muted-foreground">No data</div>
      ) : (
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={data}
                dataKey="value"
                nameKey="name"
                cx="50%"
                cy="50%"
                innerRadius={50}
                outerRadius={80}
                paddingAngle={2}
              >
                {data.map((_, i) => (
                  <Cell key={i} fill={COLORS[i % COLORS.length]} stroke="transparent" />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{
                  background: "var(--popover)",
                  border: "1px solid var(--border)",
                  borderRadius: 8,
                  fontSize: 12,
                }}
                formatter={(v: number) => `₹${v.toLocaleString("en-IN", { maximumFractionDigits: 0 })}`}
              />
              <Legend
                wrapperStyle={{ fontSize: 11, fontFamily: "var(--font-mono)" }}
                iconSize={8}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
