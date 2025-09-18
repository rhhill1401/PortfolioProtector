10 Prompting Rules (Keep It Tight)

These rules apply as both a user rule and a project rule for prompts authored in this repository.

1) Set the role and boundaries first
Example: "You are a Senior React/React Native + TypeScript engineer on macOS. Plain text only. One step at a time."  
Why: models follow explicit, high‑level rules best.  
Source: OpenAI Cookbook

2) State the goal and the single deliverable
Example: "Goal: fix X. Deliverable: one paste‑ready file or a unified diff patch."

3) Lock the output format
- If you need structured data, demand strict JSON and give a schema (or use API Structured Outputs/JSON Schema).
- If you need code, demand "code only, no commentary."  
Source: OpenAI

4) Use clear delimiters to separate parts
Use tags/sections (XML style) for <role>, <goal>, <context>, <constraints>, <output_format>, <acceptance_criteria>. This reduces confusion in long prompts.  
Source: OpenAI Cookbook

5) Put instructions at the top (and optionally repeat at the end)
In long context, placing instructions up front (and mirrored at the end) improves adherence. If rules conflict, the one near the end often wins—avoid contradictions.  
Source: OpenAI Cookbook

6) Show exactly one step at a time
Require the model to output only "Step 1" and wait for "Done" before proceeding. (This reduces error chains and over‑generation.)  
Source: OpenAI Cookbook

7) Use few‑shot examples—but make them obey the rules
Examples teach style/output. If examples contradict rules, models copy the examples—keep them consistent.  
Source: OpenAI Cookbook

8) Tell it how to handle missing info
"If information is missing, ask one clarifying question; do not guess." This prevents hallucinated changes.  
Source: OpenAI Cookbook

9) Define acceptance criteria and quick checks
E.g., "Build passes, types compile, no 'any', no unused imports, one step only, macOS paths."

10) Iterate and tighten
If outputs drift, add a specific rule or an example; remove contradictions. (OpenAI’s cookbook emphasizes iterative evals/optimization.)  
Source: OpenAI Cookbook

--

What “XML prompting” means (simple)
- Think of XML tags as big labeled boxes. The model doesn’t “parse XML” like a compiler—it just sees unambiguous sections.
- Why it helps: tags act as strong delimiters; they make long prompts scannable and reduce accidental rule mixing; works well across models.
- Limitation: tags alone don’t enforce structure; for guaranteed JSON shape in API code, use JSON Schema/Structured Outputs.  
Source: OpenAI

--

Cursor Global Rules (short)
- Plain text only. No tables, no images.
- Output exactly one step labeled "Step 1 [REF# …]" per turn; wait for my "Done."
- For code edits: return a full file or a minimal unified diff. Paste‑ready. No extra prose.
- Stack defaults: React/Next/React Native, TypeScript strict, Tailwind, Yarn, Java (backend), macOS.
- Type discipline: no `any`, no `as any`, define interfaces, keep functions small.
- Logging: wrap console logs behind a `DEBUG` flag.
- If something is ambiguous, ask one targeted question first.
- Never reveal chain‑of‑thought; provide final code or short reasoning only.

--

Minimal XML Prompt Template (reuse for any task)

<prompt_spec>
<role>You are a Senior React/React Native + TypeScript engineer on macOS. Plain text only. One step at a time.</role>
<goal>State the single task you must complete now.</goal>
<context>
<repo_paths>List key files/folders that matter.</repo_paths>
<tech_stack>React/Next/RN, TS, Tailwind, Yarn, Java, macOS</tech_stack>
</context>
<constraints>
<style>Paste‑ready code or unified diff only. No extra text.</style>
<types>No any; explicit interfaces; no unused imports.</types>
<logging>Wrap logs with DEBUG checks.</logging>
</constraints>
<output_format>
<step_control>Output only: Step 1 [REF# …]</step_control>
<deliverable>Choose one: FULL_FILE | DIFF | STRICT_JSON</deliverable>
<strict_json_schema optional="true">{ "type":"object","properties":{ "status":{"type":"string"} },"required":["status"] }</strict_json_schema>
</output_format>
<acceptance_criteria>
<build>TypeScript builds without errors.</build>
<lint>No unused imports; no dead code.</lint>
<tests>Include a minimal test or explain how to verify.</tests>
</acceptance_criteria>
<if_missing_info>Ask one clarifying question; do not guess.</if_missing_info>
</prompt_spec>

--

Example fill‑in for this repo (how to use it)

<prompt_spec>
<role>Senior RN/TS engineer. Plain text. One step.</role>
<goal>Fix OpenAI API endpoint in integrated-analysis-v2/index.ts from /v1/responses → /v1/chat/completions.</goal>
<context><repo_paths>supabase/functions/integrated-analysis-v2/index.ts</repo_paths></context>
<constraints><types>No any; no unused imports.</types></constraints>
<output_format><deliverable>DIFF</deliverable></output_format>
<acceptance_criteria>
<build>TypeScript compiles; endpoint now POSTs to /v1/chat/completions.</build>
</acceptance_criteria>
</prompt_spec>


