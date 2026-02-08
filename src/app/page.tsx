"use client";
import { useEffect, useState } from "react";
import Shell from "@/components/shell";

interface Analytics {
  totalCalls: number;
  totalAgents: number;
  avgDuration: number;
  resolutionRate: number;
  totalCost: number;
  sentimentBreakdown: { positive: number; neutral: number; negative: number };
  dailyCalls: { date: string; calls: number }[];
}

export default function Dashboard() {
  const [data, setData] = useState<Analytics | null>(null);

  useEffect(() => {
    fetch("/api/analytics").then((r) => r.json()).then(setData);
  }, []);

  return (
    <Shell>
      <div className="mb-8">
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <p className="text-[#a1a1aa] text-sm mt-1">Overview of your AI voice agent operations</p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {[
          { label: "Total Calls", value: data?.totalCalls ?? 0, color: "#7c3aed" },
          { label: "Active Agents", value: data?.totalAgents ?? 0, color: "#2563eb" },
          { label: "Avg Duration", value: `${data?.avgDuration ?? 0}s`, color: "#22c55e" },
          { label: "Resolution Rate", value: `${data?.resolutionRate ?? 0}%`, color: "#eab308" },
        ].map((stat) => (
          <div key={stat.label} className="bg-[#18181b] border border-[#27272a] rounded-xl p-5">
            <p className="text-[#a1a1aa] text-xs uppercase tracking-wider">{stat.label}</p>
            <p className="text-3xl font-bold mt-2" style={{ color: stat.color }}>{stat.value}</p>
          </div>
        ))}
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-8">
        {/* Call Volume Chart */}
        <div className="bg-[#18181b] border border-[#27272a] rounded-xl p-5">
          <h3 className="text-sm font-medium mb-4">Calls (Last 7 Days)</h3>
          <div className="flex items-end gap-2 h-32">
            {(data?.dailyCalls ?? Array(7).fill({ date: "", calls: 0 })).map((d, i) => {
              const max = Math.max(...(data?.dailyCalls?.map((x) => x.calls) ?? [1]), 1);
              const height = Math.max((d.calls / max) * 100, 4);
              return (
                <div key={i} className="flex-1 flex flex-col items-center gap-1">
                  <div
                    className="w-full bg-[#7c3aed] rounded-t transition-all"
                    style={{ height: `${height}%` }}
                    title={`${d.calls} calls`}
                  />
                  <span className="text-[10px] text-[#a1a1aa]">{d.date?.slice(5) || ""}</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Sentiment Chart */}
        <div className="bg-[#18181b] border border-[#27272a] rounded-xl p-5">
          <h3 className="text-sm font-medium mb-4">Call Sentiment</h3>
          {data ? (
            <div className="space-y-3">
              {[
                { label: "Positive", count: data.sentimentBreakdown.positive, color: "#22c55e" },
                { label: "Neutral", count: data.sentimentBreakdown.neutral, color: "#eab308" },
                { label: "Negative", count: data.sentimentBreakdown.negative, color: "#ef4444" },
              ].map((s) => {
                const total = data.sentimentBreakdown.positive + data.sentimentBreakdown.neutral + data.sentimentBreakdown.negative || 1;
                return (
                  <div key={s.label}>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-[#a1a1aa]">{s.label}</span>
                      <span>{s.count}</span>
                    </div>
                    <div className="h-2 bg-[#27272a] rounded-full overflow-hidden">
                      <div className="h-full rounded-full transition-all" style={{ width: `${(s.count / total) * 100}%`, backgroundColor: s.color }} />
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-[#a1a1aa] text-sm">No data yet. Make some test calls!</p>
          )}
        </div>
      </div>

      {/* Quick Actions */}
      <div className="bg-[#18181b] border border-[#27272a] rounded-xl p-5">
        <h3 className="text-sm font-medium mb-4">Quick Start</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <a href="/agents" className="flex items-center gap-3 p-4 bg-[#27272a]/50 rounded-lg hover:bg-[#27272a] transition-colors">
            <div className="w-10 h-10 rounded-full bg-[#7c3aed]/20 flex items-center justify-center text-[#7c3aed]">+</div>
            <div>
              <p className="text-sm font-medium">Create Agent</p>
              <p className="text-xs text-[#a1a1aa]">Set up a new voice agent</p>
            </div>
          </a>
          <a href="/demo" className="flex items-center gap-3 p-4 bg-[#27272a]/50 rounded-lg hover:bg-[#27272a] transition-colors">
            <div className="w-10 h-10 rounded-full bg-[#2563eb]/20 flex items-center justify-center text-[#2563eb]">&#9654;</div>
            <div>
              <p className="text-sm font-medium">Test Call</p>
              <p className="text-xs text-[#a1a1aa]">Try a demo conversation</p>
            </div>
          </a>
          <a href="/calls" className="flex items-center gap-3 p-4 bg-[#27272a]/50 rounded-lg hover:bg-[#27272a] transition-colors">
            <div className="w-10 h-10 rounded-full bg-[#22c55e]/20 flex items-center justify-center text-[#22c55e]">&#9742;</div>
            <div>
              <p className="text-sm font-medium">Call Logs</p>
              <p className="text-xs text-[#a1a1aa]">View call history</p>
            </div>
          </a>
        </div>
      </div>
    </Shell>
  );
}
