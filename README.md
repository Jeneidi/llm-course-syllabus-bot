# Syllabus Bot (web)

Single-page, no-framework client (`index.html` / `style.css` / `app.js`) that lets a visitor drop in a syllabus PDF, paste their own OpenAI API key, and ask grounded questions about it. Built as a CV/portfolio demo, not a product.

## Architecture

```
browser (BYOK key in memory/sessionStorage)
  → /api/openai/[...path].js   (Vercel function, just forwards + adds CORS)
    → api.openai.com/v1/*
```

- **Why a proxy at all:** OpenAI's REST API does not return CORS headers, so a static page calling `api.openai.com` directly from `fetch()` is blocked by the browser regardless of key validity. The proxy in `api/openai/[...path].js` is a generic forwarder — it doesn't parse, log, or store the request; it streams the upstream response straight back (`Readable.fromWeb(upstream.body).pipe(res)`), so streaming responses pass through untouched.
- **Why Responses API, not Assistants API:** OpenAI is sunsetting the Assistants API on **August 26, 2026**. Everything here (`/v1/files`, `/v1/vector_stores`, `/v1/responses` with the `file_search` tool) is the documented forward-compatible replacement, already at feature parity.
- **Retrieval:** each uploaded PDF is attached to an OpenAI-managed vector store (`POST /vector_stores/{id}/files`), which auto-chunks/embeds/indexes server-side — no client-side PDF parsing.
- **Conversation state:** `previous_response_id` chaining, no manual thread/message management. Note: `instructions` is *not* carried across turns by `previous_response_id` and must be resent on every call — see `prompts.js`.

## BYOK threat model

The key is typed into the page and used only to call OpenAI through the proxy above.

- The proxy never logs or persists the key or the request/response bodies — it's a stateless forward.
- The key still technically transits a server you control (the Vercel function), so "never touches a server" would be dishonest framing — the on-page copy says "relayed through a proxy... never logs or stores it" instead.
- `sessionStorage` (not `localStorage`) is used for the optional "remember" checkbox, so a saved key dies with the tab.
- CORS on the proxy is currently `Access-Control-Allow-Origin: *`. Fine for a demo; lock it to your domain once deployed somewhere permanent.

## Prompt-injection / scope guardrail

`prompts.js` holds `SYSTEM_INSTRUCTIONS`, sent as the `instructions` field on every `/responses` call. It does two things:

1. Refuses anything not actually answerable from the uploaded syllabus (general knowledge, unrelated tasks, "ignore your instructions" attempts) with a fixed sentence (`OFF_TOPIC_REPLY`), instead of falling back to the model's general knowledge.
2. Tells the model to treat retrieved document text as **untrusted data**, not instructions — so a syllabus PDF that contained injected text trying to redirect the assistant gets ignored.

This is enforced model-side via `instructions` (which the Responses API prioritizes over `input`), not via brittle client-side keyword matching.

### Testing the guardrail

```
OPENAI_API_KEY=sk-... node test/guardrail.mjs
```

Spins up a throwaway vector store with a tiny fixture syllabus, fires 10 on-topic/off-topic prompts at the real API, asserts refusal vs. answer for each, deletes the test store/file when done, exits non-zero on any failure. Costs a handful of `gpt-4o-mini` calls to run.

## Deploy

```
npm i -g vercel
vercel
```

Zero config — Vercel serves the static files and auto-detects the `/api` function.

## Local dev (static files only, no proxy)

```
python3 -m http.server 8743
```

Chat won't work without the proxy (CORS), but layout/upload UI can be checked this way.
