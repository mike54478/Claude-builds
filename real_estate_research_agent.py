#!/usr/bin/env python3
"""
Real Estate Marketing Agency Research Agent

Uses Claude's server-side web search to research strategies for building
a successful real estate marketing agency targeting realtors.
"""

import anthropic
import sys


SYSTEM_PROMPT = """You are an expert market research analyst specializing in real estate marketing.

Your task is to conduct thorough research on how to build a successful real estate marketing agency that serves realtors as clients.

Focus your research on:
1. **Current Market Landscape** — What does the real estate marketing services market look like right now? Who are the key players?
2. **Services That Realtors Actually Pay For** — What marketing services are realtors currently buying? (social media management, lead generation, SEO, video/drone content, AI tools, etc.)
3. **What's Working Right Now** — Which marketing strategies and channels are delivering the best ROI for realtors in the current market?
4. **Pricing & Business Models** — How are successful agencies pricing their services? Retainers, per-listing, performance-based?
5. **Client Acquisition** — How do successful real estate marketing agencies find and close realtor clients?
6. **Technology & Tools** — What platforms, software, and AI tools are agencies using to deliver results efficiently?
7. **Differentiation Strategies** — What makes top agencies stand out from the competition?

Use web search extensively to find the most current and relevant information. Search for recent articles, case studies, industry reports, and expert opinions.

After completing your research, compile a comprehensive report organized by the sections above. Include specific examples, data points, and actionable recommendations where possible."""


def run_research_agent():
    client = anthropic.Anthropic()

    print("=" * 70)
    print("  REAL ESTATE MARKETING AGENCY RESEARCH AGENT")
    print("  Researching what's currently working in the market...")
    print("=" * 70)
    print()

    messages = [
        {
            "role": "user",
            "content": (
                "Research how to build a successful real estate marketing agency "
                "that targets realtors as clients. I need a comprehensive report on "
                "what's currently working in the market — services in demand, effective "
                "strategies, pricing models, how to acquire realtor clients, and what "
                "technology/tools top agencies are using. Search the web thoroughly "
                "for the latest information and trends."
            ),
        }
    ]

    tools = [
        {"type": "web_search_20260209", "name": "web_search"},
        {"type": "web_fetch_20260209", "name": "web_fetch"},
    ]

    full_response_text = []

    while True:
        with client.messages.stream(
            model="claude-opus-4-8",
            max_tokens=16000,
            system=SYSTEM_PROMPT,
            thinking={"type": "adaptive"},
            tools=tools,
            messages=messages,
        ) as stream:
            current_text = ""
            for event in stream:
                if event.type == "content_block_start":
                    if hasattr(event.content_block, "type"):
                        if event.content_block.type == "server_tool_use":
                            tool_name = event.content_block.name
                            print(f"[Searching: {tool_name}...]", flush=True)
                elif event.type == "text":
                    print(event.text, end="", flush=True)
                    current_text += event.text

            response = stream.get_final_message()

        if current_text:
            full_response_text.append(current_text)

        if response.stop_reason == "end_turn":
            break

        if response.stop_reason == "pause_turn":
            messages = [
                messages[0],
                {"role": "assistant", "content": response.content},
            ]
            print("\n[Continuing research...]", flush=True)
            continue

        tool_use_blocks = [b for b in response.content if b.type == "tool_use"]
        if not tool_use_blocks:
            break

        messages.append({"role": "assistant", "content": response.content})
        tool_results = []
        for tool in tool_use_blocks:
            tool_results.append(
                {
                    "type": "tool_result",
                    "tool_use_id": tool.id,
                    "content": "Tool executed server-side.",
                }
            )
        messages.append({"role": "user", "content": tool_results})

    print("\n")
    print("=" * 70)
    print("  Research complete!")
    print("=" * 70)

    report = "\n".join(full_response_text)
    with open("research_report.md", "w") as f:
        f.write("# Real Estate Marketing Agency Research Report\n\n")
        f.write(report)
    print(f"\nReport saved to: research_report.md")

    return report


if __name__ == "__main__":
    run_research_agent()
