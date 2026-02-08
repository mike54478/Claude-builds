"use client";
import { useEffect, useState } from "react";
import Shell from "@/components/shell";

interface Call {
  id: string;
  agentId: string;
  callerNumber: string | null;
  status: string;
  direction: string;
  duration: number;
  summary: string | null;
  sentiment: string | null;
  resolved: boolean;
  startedAt: string;
  agent: { name: string };
  _count: { messages: number };
}

export default function CallsPage() {
  const [calls, setCalls] = useState<Call[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [messages, setMessages] = useState<{ role: string; content: string; timestamp: string }[]>([]);

  useEffect(() => {
    fetch("/api/calls").then((r) => r.json()).then(setCalls);
  }, []);

  const viewCall = async (callId: string) => {
    setSelected(callId);
    const data = await fetch(`/api/calls/${callId}`).then((r) => r.json());
    setMessages(data.messages || []);
  };

  const sentimentColor = (s: string | null) => {
    if (s === "positive") return "#22c55e";
    if (s === "negative") return "#ef4444";
    return "#eab308";
  };

  const statusColor = (s: string) => {
    if (s === "completed") return "bg-[#22c55e]/15 text-[#22c55e]";
    if (s === "in-progress") return "bg-[#2563eb]/15 text-[#2563eb]";
    if (s === "failed") return "bg-[#ef4444]/15 text-[#ef4444]";
    return "bg-[#27272a] text-[#a1a1aa]";
  };

  return (
    <Shell>
      <div className="mb-8">
        <h1 className="text-2xl font-bold">Call Logs</h1>
        <p className="text-[#a1a1aa] text-sm mt-1">View all voice agent conversations</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Call List */}
        <div className="lg:col-span-2">
          {calls.length === 0 ? (
            <div className="text-center py-20 text-[#a1a1aa] bg-[#18181b] border border-[#27272a] rounded-xl">
              <p className="text-lg mb-2">No calls yet</p>
              <p className="text-sm">Make a test call from the Demo page</p>
            </div>
          ) : (
            <div className="bg-[#18181b] border border-[#27272a] rounded-xl overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[#27272a] text-[#a1a1aa] text-xs">
                    <th className="text-left p-3 font-medium">Agent</th>
                    <th className="text-left p-3 font-medium">Caller</th>
                    <th className="text-left p-3 font-medium">Status</th>
                    <th className="text-left p-3 font-medium">Duration</th>
                    <th className="text-left p-3 font-medium">Sentiment</th>
                    <th className="text-left p-3 font-medium">Date</th>
                  </tr>
                </thead>
                <tbody>
                  {calls.map((call) => (
                    <tr key={call.id} onClick={() => viewCall(call.id)}
                      className={`border-b border-[#27272a] cursor-pointer transition-colors hover:bg-[#27272a]/50 ${selected === call.id ? "bg-[#7c3aed]/10" : ""}`}>
                      <td className="p-3 font-medium">{call.agent.name}</td>
                      <td className="p-3 text-[#a1a1aa]">{call.callerNumber || "Unknown"}</td>
                      <td className="p-3"><span className={`text-xs px-2 py-1 rounded-full ${statusColor(call.status)}`}>{call.status}</span></td>
                      <td className="p-3 text-[#a1a1aa]">{call.duration}s</td>
                      <td className="p-3">
                        {call.sentiment && <span className="text-xs" style={{ color: sentimentColor(call.sentiment) }}>{call.sentiment}</span>}
                      </td>
                      <td className="p-3 text-[#a1a1aa] text-xs">{new Date(call.startedAt).toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Call Detail */}
        <div>
          {selected ? (
            <div className="bg-[#18181b] border border-[#27272a] rounded-xl p-5">
              <h3 className="text-sm font-medium mb-1">Conversation Transcript</h3>
              <p className="text-xs text-[#a1a1aa] mb-4">{messages.length} messages</p>
              <div className="space-y-3 max-h-[500px] overflow-y-auto">
                {messages.map((msg, i) => (
                  <div key={i} className={`text-xs p-3 rounded-lg ${msg.role === "assistant" ? "bg-[#7c3aed]/10 text-[#c4b5fd]" : msg.role === "user" ? "bg-[#27272a] text-[#fafafa]" : "bg-[#27272a]/50 text-[#a1a1aa] italic"}`}>
                    <span className="font-medium block mb-1 capitalize">{msg.role}</span>
                    {msg.content}
                  </div>
                ))}
              </div>
              {(() => {
                const call = calls.find((c) => c.id === selected);
                return call?.summary ? (
                  <div className="mt-4 pt-4 border-t border-[#27272a]">
                    <p className="text-xs text-[#a1a1aa] mb-1">Summary</p>
                    <p className="text-sm">{call.summary}</p>
                  </div>
                ) : null;
              })()}
            </div>
          ) : (
            <div className="bg-[#18181b] border border-[#27272a] rounded-xl p-5 text-center text-[#a1a1aa] text-sm">
              Select a call to view its transcript
            </div>
          )}
        </div>
      </div>
    </Shell>
  );
}
