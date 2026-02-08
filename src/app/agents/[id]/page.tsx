"use client";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Shell from "@/components/shell";

interface KBEntry { id: string; title: string; content: string; category: string }

export default function AgentDetailPage() {
  const { id } = useParams();
  const router = useRouter();
  const [agent, setAgent] = useState<Record<string, unknown> | null>(null);
  const [kb, setKb] = useState<KBEntry[]>([]);
  const [saving, setSaving] = useState(false);
  const [showAddKB, setShowAddKB] = useState(false);
  const [kbForm, setKbForm] = useState({ title: "", content: "", category: "general" });

  const load = () => {
    fetch(`/api/agents/${id}`).then((r) => r.json()).then((d) => { setAgent(d); setKb(d.knowledgeBase || []); });
  };
  useEffect(() => { load(); }, [id]);

  const save = async () => {
    setSaving(true);
    await fetch(`/api/agents/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(agent),
    });
    setSaving(false);
  };

  const addKB = async () => {
    if (!kbForm.title.trim() || !kbForm.content.trim()) return;
    await fetch(`/api/agents/${id}/knowledge`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(kbForm),
    });
    setKbForm({ title: "", content: "", category: "general" });
    setShowAddKB(false);
    load();
  };

  const deleteKB = async (entryId: string) => {
    await fetch(`/api/agents/${id}/knowledge/${entryId}`, { method: "DELETE" });
    load();
  };

  if (!agent) return <Shell><div className="text-[#a1a1aa]">Loading...</div></Shell>;

  const update = (key: string, val: unknown) => setAgent({ ...agent, [key]: val });

  return (
    <Shell>
      <div className="flex items-center justify-between mb-8">
        <div>
          <button onClick={() => router.push("/agents")} className="text-[#a1a1aa] text-sm hover:text-white mb-2 block">&larr; Back to Agents</button>
          <h1 className="text-2xl font-bold">{agent.name as string}</h1>
        </div>
        <button onClick={save} disabled={saving} className="bg-[#7c3aed] hover:bg-[#6d28d9] disabled:opacity-50 text-white px-5 py-2 rounded-lg text-sm font-medium transition-colors">
          {saving ? "Saving..." : "Save Changes"}
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Agent Config */}
        <div className="space-y-4">
          <div className="bg-[#18181b] border border-[#27272a] rounded-xl p-5">
            <h3 className="text-sm font-medium mb-4">General Settings</h3>
            <div className="space-y-3">
              <div>
                <label className="text-xs text-[#a1a1aa] block mb-1">Agent Name</label>
                <input value={(agent.name as string) || ""} onChange={(e) => update("name", e.target.value)}
                  className="w-full bg-[#09090b] border border-[#27272a] rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#7c3aed]" />
              </div>
              <div>
                <label className="text-xs text-[#a1a1aa] block mb-1">Greeting Message</label>
                <textarea value={(agent.greeting as string) || ""} onChange={(e) => update("greeting", e.target.value)} rows={2}
                  className="w-full bg-[#09090b] border border-[#27272a] rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#7c3aed] resize-none" />
              </div>
              <div>
                <label className="text-xs text-[#a1a1aa] block mb-1">System Prompt</label>
                <textarea value={(agent.systemPrompt as string) || ""} onChange={(e) => update("systemPrompt", e.target.value)} rows={4}
                  className="w-full bg-[#09090b] border border-[#27272a] rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#7c3aed] resize-none" />
              </div>
            </div>
          </div>

          <div className="bg-[#18181b] border border-[#27272a] rounded-xl p-5">
            <h3 className="text-sm font-medium mb-4">Voice & Model</h3>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-[#a1a1aa] block mb-1">Voice</label>
                <select value={(agent.voice as string) || "alloy"} onChange={(e) => update("voice", e.target.value)}
                  className="w-full bg-[#09090b] border border-[#27272a] rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#7c3aed]">
                  {["alloy", "echo", "fable", "onyx", "nova", "shimmer"].map((v) => <option key={v} value={v}>{v}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs text-[#a1a1aa] block mb-1">Language</label>
                <select value={(agent.language as string) || "en-US"} onChange={(e) => update("language", e.target.value)}
                  className="w-full bg-[#09090b] border border-[#27272a] rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#7c3aed]">
                  {["en-US", "en-GB", "es-ES", "fr-FR", "de-DE", "ja-JP"].map((l) => <option key={l} value={l}>{l}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs text-[#a1a1aa] block mb-1">AI Model</label>
                <select value={(agent.model as string) || "gpt-4o"} onChange={(e) => update("model", e.target.value)}
                  className="w-full bg-[#09090b] border border-[#27272a] rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#7c3aed]">
                  {["gpt-4o", "gpt-4o-mini", "claude-sonnet-4-5-20250929"].map((m) => <option key={m} value={m}>{m}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs text-[#a1a1aa] block mb-1">Temperature ({String(agent.temperature ?? 0.7)})</label>
                <input type="range" min="0" max="1" step="0.1" value={Number(agent.temperature ?? 0.7)} onChange={(e) => update("temperature", parseFloat(e.target.value))}
                  className="w-full accent-[#7c3aed]" />
              </div>
            </div>
          </div>

          <div className="bg-[#18181b] border border-[#27272a] rounded-xl p-5">
            <h3 className="text-sm font-medium mb-4">Phone Settings</h3>
            <div className="space-y-3">
              <div>
                <label className="text-xs text-[#a1a1aa] block mb-1">Phone Number (Twilio)</label>
                <input value={(agent.phoneNumber as string) || ""} onChange={(e) => update("phoneNumber", e.target.value)} placeholder="+1234567890"
                  className="w-full bg-[#09090b] border border-[#27272a] rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#7c3aed]" />
              </div>
              <div>
                <label className="text-xs text-[#a1a1aa] block mb-1">Transfer Number (for human handoff)</label>
                <input value={(agent.transferNumber as string) || ""} onChange={(e) => update("transferNumber", e.target.value)} placeholder="+1234567890"
                  className="w-full bg-[#09090b] border border-[#27272a] rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#7c3aed]" />
              </div>
            </div>
          </div>
        </div>

        {/* Knowledge Base */}
        <div>
          <div className="bg-[#18181b] border border-[#27272a] rounded-xl p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-medium">Knowledge Base ({kb.length} entries)</h3>
              <button onClick={() => setShowAddKB(true)} className="text-xs bg-[#7c3aed]/15 hover:bg-[#7c3aed]/25 text-[#7c3aed] px-3 py-1.5 rounded-lg transition-colors">
                + Add Entry
              </button>
            </div>

            {showAddKB && (
              <div className="bg-[#09090b] border border-[#27272a] rounded-lg p-4 mb-4">
                <input value={kbForm.title} onChange={(e) => setKbForm({ ...kbForm, title: e.target.value })} placeholder="Title (e.g. Refund Policy)"
                  className="w-full bg-[#18181b] border border-[#27272a] rounded-lg px-3 py-2 text-sm mb-2 focus:outline-none focus:border-[#7c3aed]" />
                <textarea value={kbForm.content} onChange={(e) => setKbForm({ ...kbForm, content: e.target.value })} placeholder="Content..." rows={3}
                  className="w-full bg-[#18181b] border border-[#27272a] rounded-lg px-3 py-2 text-sm mb-2 focus:outline-none focus:border-[#7c3aed] resize-none" />
                <div className="flex gap-2">
                  <select value={kbForm.category} onChange={(e) => setKbForm({ ...kbForm, category: e.target.value })}
                    className="bg-[#18181b] border border-[#27272a] rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#7c3aed]">
                    {["general", "pricing", "hours", "faq", "policy", "product"].map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                  <button onClick={addKB} className="bg-[#7c3aed] hover:bg-[#6d28d9] text-white px-4 py-2 rounded-lg text-sm transition-colors">Add</button>
                  <button onClick={() => setShowAddKB(false)} className="text-[#a1a1aa] hover:text-white px-3 py-2 text-sm transition-colors">Cancel</button>
                </div>
              </div>
            )}

            {kb.length === 0 ? (
              <p className="text-[#a1a1aa] text-sm text-center py-8">No knowledge base entries. Add information your agent should know.</p>
            ) : (
              <div className="space-y-2 max-h-[600px] overflow-y-auto">
                {kb.map((entry) => (
                  <div key={entry.id} className="bg-[#09090b] border border-[#27272a] rounded-lg p-3">
                    <div className="flex items-start justify-between">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <h4 className="text-sm font-medium truncate">{entry.title}</h4>
                          <span className="text-[10px] bg-[#27272a] px-2 py-0.5 rounded-full text-[#a1a1aa] shrink-0">{entry.category}</span>
                        </div>
                        <p className="text-xs text-[#a1a1aa] line-clamp-2">{entry.content}</p>
                      </div>
                      <button onClick={() => deleteKB(entry.id)} className="text-[#ef4444] hover:bg-[#ef4444]/10 p-1 rounded text-xs ml-2 shrink-0">&#10005;</button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </Shell>
  );
}
