"use client";
import { Suspense, useEffect, useState, useRef } from "react";
import { useSearchParams } from "next/navigation";
import Shell from "@/components/shell";

interface Agent { id: string; name: string }
interface Msg { role: string; content: string }

export default function DemoPage() {
  return (
    <Suspense fallback={<Shell><div className="text-[#a1a1aa]">Loading...</div></Shell>}>
      <DemoContent />
    </Suspense>
  );
}

function DemoContent() {
  const searchParams = useSearchParams();
  const preselected = searchParams.get("agent");

  const [agents, setAgents] = useState<Agent[]>([]);
  const [agentId, setAgentId] = useState(preselected || "");
  const [callId, setCallId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [callActive, setCallActive] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch("/api/agents").then((r) => r.json()).then((data) => {
      setAgents(data);
      if (preselected) setAgentId(preselected);
      else if (data.length > 0 && !agentId) setAgentId(data[0].id);
    });
  }, []);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  const startCall = async () => {
    if (!agentId) return;
    setLoading(true);
    const res = await fetch("/api/demo-call", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ agentId }),
    }).then((r) => r.json());
    setCallId(res.callId);
    setMessages([{ role: "assistant", content: res.message }]);
    setCallActive(true);
    setLoading(false);
  };

  const sendMessage = async () => {
    if (!input.trim() || !callId || loading) return;
    const userMsg = input.trim();
    setInput("");
    setMessages((prev) => [...prev, { role: "user", content: userMsg }]);
    setLoading(true);

    const res = await fetch("/api/demo-call", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ agentId, callId, userMessage: userMsg }),
    }).then((r) => r.json());

    setMessages((prev) => [...prev, { role: "assistant", content: res.message }]);
    if (res.status === "completed") setCallActive(false);
    setLoading(false);
  };

  const endCall = async () => {
    if (callId) {
      await fetch(`/api/calls/${callId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "completed", endedAt: new Date().toISOString() }),
      });
    }
    setCallActive(false);
    setCallId(null);
  };

  const reset = () => {
    setCallId(null);
    setMessages([]);
    setCallActive(false);
    setInput("");
  };

  return (
    <Shell>
      <div className="mb-8">
        <h1 className="text-2xl font-bold">Test Call</h1>
        <p className="text-[#a1a1aa] text-sm mt-1">Simulate a voice conversation with your AI agent</p>
      </div>

      <div className="max-w-2xl mx-auto">
        {/* Agent Selector */}
        {!callActive && !callId && (
          <div className="bg-[#18181b] border border-[#27272a] rounded-xl p-6 mb-6">
            <h3 className="text-sm font-medium mb-4">Select an Agent</h3>
            {agents.length === 0 ? (
              <p className="text-[#a1a1aa] text-sm">No agents created yet. <a href="/agents" className="text-[#7c3aed] hover:underline">Create one first</a>.</p>
            ) : (
              <>
                <select value={agentId} onChange={(e) => setAgentId(e.target.value)}
                  className="w-full bg-[#09090b] border border-[#27272a] rounded-lg px-3 py-2.5 text-sm mb-4 focus:outline-none focus:border-[#7c3aed]">
                  {agents.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
                </select>
                <button onClick={startCall} disabled={loading || !agentId}
                  className="w-full bg-[#22c55e] hover:bg-[#16a34a] disabled:opacity-50 text-white py-3 rounded-lg font-medium transition-colors flex items-center justify-center gap-2">
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                  </svg>
                  Start Test Call
                </button>
              </>
            )}
          </div>
        )}

        {/* Call Window */}
        {(callActive || messages.length > 0) && (
          <div className="bg-[#18181b] border border-[#27272a] rounded-xl overflow-hidden">
            {/* Call Header */}
            <div className="flex items-center justify-between p-4 border-b border-[#27272a]">
              <div className="flex items-center gap-3">
                <div className={`w-3 h-3 rounded-full ${callActive ? "bg-[#22c55e] animate-pulse" : "bg-[#ef4444]"}`} />
                <div>
                  <p className="text-sm font-medium">{agents.find((a) => a.id === agentId)?.name || "Agent"}</p>
                  <p className="text-xs text-[#a1a1aa]">{callActive ? "Call in progress..." : "Call ended"}</p>
                </div>
              </div>
              {callActive && (
                <button onClick={endCall} className="bg-[#ef4444] hover:bg-[#dc2626] text-white px-4 py-1.5 rounded-lg text-sm transition-colors">
                  End Call
                </button>
              )}
              {!callActive && messages.length > 0 && (
                <button onClick={reset} className="bg-[#27272a] hover:bg-[#3f3f46] text-white px-4 py-1.5 rounded-lg text-sm transition-colors">
                  New Call
                </button>
              )}
            </div>

            {/* Messages */}
            <div className="p-4 h-96 overflow-y-auto space-y-3">
              {messages.map((msg, i) => (
                <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                  <div className={`max-w-[80%] px-4 py-2.5 rounded-2xl text-sm ${
                    msg.role === "user" ? "bg-[#7c3aed] text-white rounded-br-md" : "bg-[#27272a] text-[#fafafa] rounded-bl-md"
                  }`}>
                    {msg.content}
                  </div>
                </div>
              ))}
              {loading && (
                <div className="flex justify-start">
                  <div className="bg-[#27272a] px-4 py-3 rounded-2xl rounded-bl-md">
                    <div className="flex gap-1.5">
                      <div className="w-2 h-2 bg-[#a1a1aa] rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                      <div className="w-2 h-2 bg-[#a1a1aa] rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                      <div className="w-2 h-2 bg-[#a1a1aa] rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
                    </div>
                  </div>
                </div>
              )}
              <div ref={bottomRef} />
            </div>

            {/* Input */}
            {callActive && (
              <div className="p-4 border-t border-[#27272a]">
                <div className="flex gap-2">
                  <input value={input} onChange={(e) => setInput(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && sendMessage()}
                    placeholder="Type your message (simulating speech)..."
                    className="flex-1 bg-[#09090b] border border-[#27272a] rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:border-[#7c3aed]"
                    disabled={loading} autoFocus />
                  <button onClick={sendMessage} disabled={loading || !input.trim()}
                    className="bg-[#7c3aed] hover:bg-[#6d28d9] disabled:opacity-50 text-white px-5 py-2.5 rounded-lg text-sm font-medium transition-colors">
                    Send
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* How it works */}
        {!callActive && messages.length === 0 && (
          <div className="bg-[#18181b] border border-[#27272a] rounded-xl p-6">
            <h3 className="text-sm font-medium mb-4">How it works</h3>
            <div className="space-y-3 text-sm text-[#a1a1aa]">
              <div className="flex gap-3 items-start">
                <span className="w-6 h-6 rounded-full bg-[#7c3aed]/15 text-[#7c3aed] flex items-center justify-center text-xs shrink-0">1</span>
                <p>Create an agent and configure its personality, greeting, and system prompt</p>
              </div>
              <div className="flex gap-3 items-start">
                <span className="w-6 h-6 rounded-full bg-[#7c3aed]/15 text-[#7c3aed] flex items-center justify-center text-xs shrink-0">2</span>
                <p>Add knowledge base entries with your business info (FAQs, policies, hours, etc.)</p>
              </div>
              <div className="flex gap-3 items-start">
                <span className="w-6 h-6 rounded-full bg-[#7c3aed]/15 text-[#7c3aed] flex items-center justify-center text-xs shrink-0">3</span>
                <p>Test the agent here with a simulated call - type messages to simulate speech</p>
              </div>
              <div className="flex gap-3 items-start">
                <span className="w-6 h-6 rounded-full bg-[#7c3aed]/15 text-[#7c3aed] flex items-center justify-center text-xs shrink-0">4</span>
                <p>In production, connect a Twilio number to receive real phone calls handled by AI</p>
              </div>
            </div>
          </div>
        )}
      </div>
    </Shell>
  );
}
