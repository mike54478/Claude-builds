"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import Shell from "@/components/shell";

interface Agent {
  id: string;
  name: string;
  active: boolean;
  voice: string;
  createdAt: string;
  _count: { calls: number; knowledgeBase: number };
}

export default function AgentsPage() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [name, setName] = useState("");

  const load = () => fetch("/api/agents").then((r) => r.json()).then(setAgents);
  useEffect(() => { load(); }, []);

  const create = async () => {
    if (!name.trim()) return;
    await fetch("/api/agents", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name }) });
    setName("");
    setShowCreate(false);
    load();
  };

  const remove = async (id: string) => {
    if (!confirm("Delete this agent?")) return;
    await fetch(`/api/agents/${id}`, { method: "DELETE" });
    load();
  };

  return (
    <Shell>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold">Voice Agents</h1>
          <p className="text-[#a1a1aa] text-sm mt-1">Manage your AI voice agents</p>
        </div>
        <button onClick={() => setShowCreate(true)} className="bg-[#7c3aed] hover:bg-[#6d28d9] text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors">
          + New Agent
        </button>
      </div>

      {/* Create Modal */}
      {showCreate && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50" onClick={() => setShowCreate(false)}>
          <div className="bg-[#18181b] border border-[#27272a] rounded-xl p-6 w-full max-w-md" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-lg font-bold mb-4">Create New Agent</h2>
            <input
              value={name} onChange={(e) => setName(e.target.value)} placeholder="Agent name (e.g. Sales Bot)"
              className="w-full bg-[#09090b] border border-[#27272a] rounded-lg px-3 py-2 text-sm mb-4 focus:outline-none focus:border-[#7c3aed]"
              onKeyDown={(e) => e.key === "Enter" && create()}
              autoFocus
            />
            <div className="flex gap-2 justify-end">
              <button onClick={() => setShowCreate(false)} className="px-4 py-2 text-sm text-[#a1a1aa] hover:text-white transition-colors">Cancel</button>
              <button onClick={create} className="bg-[#7c3aed] hover:bg-[#6d28d9] text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors">Create</button>
            </div>
          </div>
        </div>
      )}

      {/* Agent Grid */}
      {agents.length === 0 ? (
        <div className="text-center py-20 text-[#a1a1aa]">
          <p className="text-4xl mb-4">&#129302;</p>
          <p className="text-lg mb-2">No agents yet</p>
          <p className="text-sm">Create your first AI voice agent to get started</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {agents.map((agent) => (
            <div key={agent.id} className="bg-[#18181b] border border-[#27272a] rounded-xl p-5 hover:border-[#7c3aed]/50 transition-colors">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <h3 className="font-semibold">{agent.name}</h3>
                  <p className="text-xs text-[#a1a1aa] mt-0.5">Voice: {agent.voice}</p>
                </div>
                <span className={`text-xs px-2 py-1 rounded-full ${agent.active ? "bg-[#22c55e]/15 text-[#22c55e]" : "bg-[#ef4444]/15 text-[#ef4444]"}`}>
                  {agent.active ? "Active" : "Inactive"}
                </span>
              </div>
              <div className="flex gap-4 text-xs text-[#a1a1aa] mb-4">
                <span>{agent._count.calls} calls</span>
                <span>{agent._count.knowledgeBase} KB entries</span>
              </div>
              <div className="flex gap-2">
                <Link href={`/agents/${agent.id}`} className="flex-1 text-center bg-[#27272a] hover:bg-[#3f3f46] px-3 py-2 rounded-lg text-xs transition-colors">
                  Configure
                </Link>
                <Link href={`/demo?agent=${agent.id}`} className="flex-1 text-center bg-[#7c3aed]/15 hover:bg-[#7c3aed]/25 text-[#7c3aed] px-3 py-2 rounded-lg text-xs transition-colors">
                  Test Call
                </Link>
                <button onClick={() => remove(agent.id)} className="px-3 py-2 rounded-lg text-xs text-[#ef4444] hover:bg-[#ef4444]/10 transition-colors">
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </Shell>
  );
}
