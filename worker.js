/**
 * CLOUDFLARE WORKER: AUTHOR COMMAND CENTER (Safe Mode)
 * Model: OpenRouter Free Tier (Gemini 2.0 Flash Lite)
 * Status: Ad-Blocker Safe
 */

// CONFIGURATION: THIS IS THE FREE MODEL ID
const MODEL_ID = "openrouter/free"; 

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

addEventListener("fetch", event => {
  event.respondWith(handleRequest(event.request));
});

async function handleRequest(request) {
  // Handle CORS Preflight
  if (request.method === "OPTIONS") return new Response(null, { headers: CORS_HEADERS });

  // Serve UI
  if (request.method === "GET") return new Response(HTML_UI, { headers: { "Content-Type": "text/html", ...CORS_HEADERS } });

  // Handle API Requests
  if (request.method === "POST") {
    try {
      const { job_type, content } = await request.json(); 

      // JOB: Generate Cover Art Prompt
      if (job_type === "make_art") {
        const prompt = await generateCoverPrompt(content);
        return new Response(JSON.stringify({ prompt }), { headers: { "Content-Type": "application/json", ...CORS_HEADERS } });
      }

      // JOB: Analyze Book (Renamed to 'process_book' to avoid blockers)
      if (job_type === "process_book") {
        // Run all agents in parallel
        const [tags, bisac, hooks, copy, polish] = await Promise.all([
          runAgent("get_tags", content),
          runAgent("get_bisac", content),
          runAgent("get_hooks", content),
          runFreedomShortcutBlurb(content),
          runAgent("do_polish", content)
        ]);

        return new Response(JSON.stringify({ tags, bisac, hooks, copy, polish }), { 
          headers: { "Content-Type": "application/json", ...CORS_HEADERS } 
        });
      }

    } catch (err) {
      return new Response(JSON.stringify({ error: err.message }), { headers: CORS_HEADERS });
    }
  }
  return new Response("Method not allowed", { status: 405 });
}

// ---------------------------------------------------------
// AI AGENTS (Using Free Model)
// ---------------------------------------------------------

async function runAgent(mode, input) {
  const raw = await callOpenRouter(PROMPTS[mode], input);
  return cleanOutput(raw);
}

// Freedom Shortcut Specific Logic
async function runFreedomShortcutBlurb(input) {
  const draftPrompt = `
    Using the 'Freedom Shortcut' method, write a blurb.
    Structure:
    1. THE HOOK (Disruptive question)
    2. THE OPEN LOOP (Gap in knowledge)
    3. THE CONFLICT (Internal & External)
    4. THE STAKES (Consequences of failure)
    5. THE CTA.
  `;
  const draft = await callOpenRouter(draftPrompt, input);

  const critiquePrompt = `
    Refine this blurb. 
    - Remove passive voice.
    - Heighten the stakes.
    - Make it sound like a movie trailer.
    Output ONLY the final text.
    Draft: ${draft}
  `;
  const final = await callOpenRouter("You are a Copywriter.", critiquePrompt);
  return cleanOutput(final);
}

async function generateCoverPrompt(input) {
  const prompt = `Create a text-to-image prompt. Subject, Art Style, Mood. No text.`;
  return await callOpenRouter("You are an Art Director.", input.substring(0, 1000));
}

// ---------------------------------------------------------
// UTILITIES
// ---------------------------------------------------------

function cleanOutput(text) {
  if (!text) return "";
  return text
    .replace(/```json/g, "")
    .replace(/```/g, "")
    .replace(/^\s*[\r\n]/gm, "")
    .replace(/"/g, "")
    .replace(/\[|\]/g, "")
    .trim();
}

async function callOpenRouter(system, user) {
  // Use Dashboard Variable for Key
  const apiKey = typeof OPENROUTER_API_KEY !== 'undefined' ? OPENROUTER_API_KEY : ""; 
  
  const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "HTTP-Referer": "https://cloudflare-worker.com",
      "X-Title": "AuthorDashboard"
    },
    body: JSON.stringify({
      model: MODEL_ID, // Uses the variable defined at the top
      messages: [
        { role: "system", content: system },
        { role: "user", content: user.substring(0, 15000) }
      ]
    })
  });

  const data = await response.json();
  return data.choices?.[0]?.message?.content || "AI Error";
}

// ---------------------------------------------------------
// PROMPTS (Clean & Specific)
// ---------------------------------------------------------
const PROMPTS = {
  get_tags: `
    Analyze text. Output exactly 7 high-traffic Amazon KDP keyword phrases.
    One phrase per line. No numbering. No bullets.
  `,
  get_bisac: `
    Identify 3 BISAC Subject Headings.
    One per line. Format: MAJOR / Minor. No numbering.
  `,
  get_hooks: `
    Generate 5 viral titles and subtitles.
    One per line. Format: Title: Subtitle. No numbering.
  `,
  do_polish: `
    Rewrite first 300 words. Show Don't Tell. Active verbs.
    Output ONLY rewritten text.
  `
};

// ---------------------------------------------------------
// UI (Updated to send "Safe" keywords)
// ---------------------------------------------------------
const HTML_UI = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Author Command Center</title>
    <style>
        :root { --bg: #0f172a; --card: #1e293b; --text: #e2e8f0; --accent: #3b82f6; --green: #10b981; }
        body { font-family: -apple-system, system-ui, sans-serif; background: var(--bg); color: var(--text); padding: 20px; margin: 0; }
        .input-box { background: var(--card); padding: 15px; border-radius: 12px; border: 1px solid #334155; margin-bottom: 20px; }
        textarea { width: 100%; height: 120px; background: #020617; color: white; border: 1px solid #334155; border-radius: 8px; padding: 10px; resize: none; font-family: inherit; }
        button { background: var(--accent); color: white; border: none; padding: 10px 20px; border-radius: 6px; cursor: pointer; font-weight: bold; width: 100%; margin-top: 10px; }
        
        .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 15px; display: none; }
        .card { background: var(--card); padding: 15px; border-radius: 12px; border: 1px solid #334155; }
        .card h3 { margin-top: 0; color: var(--accent); font-size: 0.9rem; text-transform: uppercase; letter-spacing: 1px; display: flex; justify-content: space-between; }
        
        .clean-list div { padding: 8px; border-bottom: 1px solid #334155; cursor: pointer; transition: background 0.2s; }
        .clean-list div:hover { background: #334155; }
        
        .copy-btn { background: #334155; padding: 2px 8px; font-size: 0.7rem; border-radius: 4px; }
        
        .spinner { display: inline-block; width: 20px; height: 20px; border: 3px solid rgba(255,255,255,0.3); border-radius: 50%; border-top-color: #fff; animation: spin 1s infinite; }
        @keyframes spin { to { transform: rotate(360deg); } }
    </style>
</head>
<body>

    <div class="input-box">
        <textarea id="textInput" placeholder="Paste your chapter or notes..."></textarea>
        <button id="runBtn" onclick="runSafeProcess()">🚀 Launch Analysis</button>
    </div>

    <div id="loader" style="display:none; text-align:center;">
        <div class="spinner"></div><br><br>
        <em>Running Free AI Agents...</em>
    </div>

    <div id="dashboard" class="grid">
        <div class="card"><h3>7 Top Keywords <span class="copy-btn" onclick="copyText('kw-list')">Copy All</span></h3><div id="kw-list" class="clean-list"></div></div>
        <div class="card"><h3>BISAC Genres <span class="copy-btn" onclick="copyText('bisac-list')">Copy All</span></h3><div id="bisac-list" class="clean-list"></div></div>
        <div class="card"><h3>Viral Titles <span class="copy-btn" onclick="copyText('title-list')">Copy All</span></h3><div id="title-list" class="clean-list"></div></div>
        <div class="card" style="grid-column: 1 / -1;"><h3>Freedom Shortcut Blurb <span class="copy-btn" onclick="copyText('blurb-text')">Copy</span></h3><div id="blurb-text" style="white-space: pre-wrap; line-height: 1.6; color: #cbd5e1;"></div></div>
        <div class="card" style="grid-column: 1 / -1;"><h3>Polished Excerpt <span class="copy-btn" onclick="copyText('polish-text')">Copy</span></h3><div id="polish-text" style="white-space: pre-wrap; line-height: 1.6; color: #cbd5e1;"></div></div>
        <div class="card" style="grid-column: 1 / -1; text-align: center;"><button onclick="generateCover()" style="background: transparent; border: 1px solid var(--accent); color: var(--accent);">Generate Cover Art</button><div id="cover-area" style="margin-top: 15px;"></div></div>
    </div>

    <script>
        async function runSafeProcess() {
            const text = document.getElementById('textInput').value;
            if(!text) return alert("Paste text first");

            document.getElementById('dashboard').style.display = 'none';
            document.getElementById('loader').style.display = 'block';
            document.getElementById('runBtn').disabled = true;

            const res = await fetch('/', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ job_type: 'process_book', content: text })
            });
            
            const data = await res.json();
            if (data.error) { alert("Error: " + data.error); }

            renderList('kw-list', data.tags);
            renderList('bisac-list', data.bisac);
            renderList('title-list', data.hooks);
            document.getElementById('blurb-text').innerText = data.copy;
            document.getElementById('polish-text').innerText = data.polish;

            document.getElementById('loader').style.display = 'none';
            document.getElementById('dashboard').style.display = 'grid';
            document.getElementById('runBtn').disabled = false;
        }

        function renderList(elementId, textData) {
            if (!textData) return;
            const lines = textData.split('\\n').filter(line => line.trim() !== '');
            const html = lines.map(line => \`<div onclick="copyTag(this)">\${line.trim()}</div>\`).join('');
            document.getElementById(elementId).innerHTML = html;
        }

        async function generateCover() {
            const text = document.getElementById('textInput').value;
            const area = document.getElementById('cover-area');
            area.innerHTML = 'Designing...';
            const res = await fetch('/', { method: 'POST', body: JSON.stringify({ job_type: 'make_art', content: text }) });
            const data = await res.json();
            const url = \`https://image.pollinations.ai/prompt/\${encodeURIComponent(data.prompt)}?width=768&height=1152&model=flux&nologo=true\`;
            area.innerHTML = \`<img src="\${url}" style="max-width:100%; border-radius:8px;"><br><a href="\${url}" target="_blank" style="color:#fff;">Download</a>\`;
        }

        function copyTag(el) { navigator.clipboard.writeText(el.innerText); el.style.background = '#10b981'; setTimeout(() => el.style.background = '', 400); }
        function copyText(id) { navigator.clipboard.writeText(document.getElementById(id).innerText); alert("Copied!"); }
    </script>
</body>
</html>
`;
