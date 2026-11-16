"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

const COLORS = ["#002147", "#0D4377", "#3B6EA5", "#C4A35A", "#7A90A8", "#1F4E79"];

export function YearChart({
  data,
}: {
  data: Array<{ year: number | string; count: number }>;
}) {
  if (!data.length) {
    return <EmptyChart />;
  }

  return (
    <div className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="#d7e0ea" />
          <XAxis dataKey="year" tick={{ fill: "#5b6b7c", fontSize: 12 }} />
          <YAxis allowDecimals={false} tick={{ fill: "#5b6b7c", fontSize: 12 }} />
          <Tooltip />
          <Bar dataKey="count" fill="#0D4377" radius={[6, 6, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function TypeChart({
  data,
}: {
  data: Array<{ type: string; count: number }>;
}) {
  if (!data.length) {
    return <EmptyChart />;
  }

  return (
    <div className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={data}
            dataKey="count"
            nameKey="type"
            innerRadius={48}
            outerRadius={84}
            paddingAngle={3}
          >
            {data.map((_, index) => (
              <Cell key={index} fill={COLORS[index % COLORS.length]} />
            ))}
          </Pie>
          <Tooltip />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}

function EmptyChart() {
  return (
    <div className="flex h-64 items-center justify-center text-sm text-[var(--auiq-muted)]">
      لا توجد بيانات كافية للرسم بعد
    </div>
  );
}
