/**
 * CLOUDFLARE WORKER: PURE DATA DASHBOARD
 * Features: Strict formatting, Freedom Shortcut logic, and specialized sub-agents.
 */

const MODEL_ID = "openrouter/free"; 
const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

// 1. EVENT LISTENER
addEventListener("fetch", event => {
  event.respondWith(handleRequest(event.request));
});

// 2. MAIN LOGIC
async function handleRequest(request) {
  if (request.method === "OPTIONS") return new Response(null, { headers: CORS_HEADERS });
  if (request.method === "GET") return new Response(HTML_UI, { headers: { "Content-Type": "text/html", ...CORS_HEADERS } });

  if (request.method === "POST") {
    try {
      const { action, text } = await request.json();

      if (action === "cover") {
        const prompt = await generateCoverPrompt(text);
        return new Response(JSON.stringify({ prompt }), { headers: { "Content-Type": "application/json", ...CORS_HEADERS } });
      }

      if (action === "analyze") {
        // We launch 5 specialized agents. Each has ONE job.
        // This prevents "confusion" and ensures clean output.
        const [keywords, bisac, titles, blurb, polish] = await Promise.all([
          runAgent("keywords", text),
          runAgent("bisac", text),
          runAgent("titles", text),
          runFreedomShortcutBlurb(text), // Special Logic for Blurb
          runAgent("polish", text)
        ]);

        return new Response(JSON.stringify({ keywords, bisac, titles, blurb, polish }), { 
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
// 3. SPECIALIZED AI AGENTS
// ---------------------------------------------------------

// Standard Agent: clean output, no markdown
async function runAgent(mode, input) {
  const raw = await callOpenRouter(PROMPTS[mode], input);
  return cleanOutput(raw);
}

// Freedom Shortcut Agent: Uses the specific loop you requested
async function runFreedomShortcutBlurb(input) {
  // Step 1: Draft using the Framework
  const draftPrompt = `
    Using the 'Freedom Shortcut' method, write a blurb for this book.
    Structure strictly as:
    1. THE HOOK (Disruptive question or statement)
    2. THE OPEN LOOP (Create a gap in knowledge)
    3. THE CORE CONFLICT (Internal & External)
    4. THE STAKES (What happens if they fail?)
    5. THE CALL TO ACTION.
  `;
  const draft = await callOpenRouter(draftPrompt, input);

  // Step 2: Critique & Refine (Self-Correction)
  const critiquePrompt = `
    Review this blurb. Does it have "passive voice"? Remove it.
    Are the stakes high enough? Make them higher.
    Does it sound like a generic summary? Make it sound like a movie trailer.
    REWRITE IT to be punchy and under 250 words.
    OUTPUT ONLY THE FINAL TEXT.
    
    Draft: ${draft}
  `;
  const final = await callOpenRouter("You are a Copywriter.", critiquePrompt);
  return cleanOutput(final);
}

// Cover Art Agent
async function generateCoverPrompt(input) {
  const prompt = `Create a text-to-image prompt for this book. Subject, Art Style, Mood. No text on image.`;
  return await callOpenRouter("You are an Art Director.", input.substring(0, 1000));
}

// ---------------------------------------------------------
// 4. UTILITIES (The "Janitor")
// ---------------------------------------------------------

// This function scrubs the AI response so you never see JSON or Markdown
function cleanOutput(text) {
  if (!text) return "";
  return text
    .replace(/```json/g, "")   // Remove JSON blocks
    .replace(/```/g, "")       // Remove code blocks
    .replace(/^\s*[\r\n]/gm, "") // Remove empty lines
    .replace(/"/g, "")         // Remove extra quotes
    .replace(/\[|\]/g, "")     // Remove brackets
    .trim();
}

async function callOpenRouter(system, user) {
  // Replace with your actual key variable or process.env logic
  const apiKey = OPENROUTER_API_KEY; 
  
  const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "HTTP-Referer": "https://cloudflare-worker.com",
      "X-Title": "AuthorDashboard"
    },
    body: JSON.stringify({
      model: "google/gemini-2.0-flash-lite-preview-02-05:free",
      messages: [
        { role: "system", content: system },
        { role: "user", content: user.substring(0, 15000) }
      ],
      temperature: 0.7 // Slight creativity, but controlled
    })
  });

  const data = await response.json();
  return data.choices?.[0]?.message?.content || "AI Error";
}

// ---------------------------------------------------------
// 5. PROMPTS (Surgically Precise)
// ---------------------------------------------------------
const PROMPTS = {
  keywords: `
    Analyze the text. 
    Output exactly 7 high-traffic Amazon KDP keyword phrases.
    Rules:
    - One phrase per line.
    - No numbering (1. 2. etc).
    - No bullet points.
    - No commas at the end.
    - Just the raw text phrases.
  `,
  bisac: `
    Identify the 3 best-fitting BISAC Subject Headings for this book.
    Rules:
    - One subject per line.
    - Format: MAJOR / Minor / Specific
    - No numbering or bullets.
  `,
  titles: `
    Generate 5 viral titles and subtitles.
    Rules:
    - One title per line.
    - Format: Title: Subtitle
    - No numbering or bullets.
  `,
  polish: `
    Rewrite the first 300 words to be "Show, Don't Tell".
    Remove all filter words (saw, felt, heard, knew).
    Make verbs aggressive and active.
    Output ONLY the rewritten text.
  `
};

// ---------------------------------------------------------
// 6. UI (Clean Dashboard)
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
        
        /* Specialized lists */
        .clean-list div { padding: 8px; border-bottom: 1px solid #334155; cursor: pointer; transition: background 0.2s; }
        .clean-list div:hover { background: #334155; }
        .clean-list div:last-child { border-bottom: none; }
        
        .copy-btn { background: #334155; padding: 2px 8px; font-size: 0.7rem; border-radius: 4px; }
        
        .spinner { display: inline-block; width: 20px; height: 20px; border: 3px solid rgba(255,255,255,0.3); border-radius: 50%; border-top-color: #fff; animation: spin 1s infinite; }
        @keyframes spin { to { transform: rotate(360deg); } }
    </style>
</head>
<body>

    <div class="input-box">
        <textarea id="textInput" placeholder="Paste your chapter or notes..."></textarea>
        <button id="runBtn" onclick="runAnalysis()">🚀 Launch Analysis</button>
    </div>

    <div id="loader" style="display:none; text-align:center;">
        <div class="spinner"></div><br><br>
        <em>Applying Freedom Shortcut logic...<br>Scouting 7 Top Keywords...<br>Finding BISAC Codes...</em>
    </div>

    <div id="dashboard" class="grid">
        
        <div class="card">
            <h3>7 Top Keywords <span class="copy-btn" onclick="copyText('kw-list')">Copy All</span></h3>
            <div id="kw-list" class="clean-list"></div>
        </div>

        <div class="card">
            <h3>BISAC Genres <span class="copy-btn" onclick="copyText('bisac-list')">Copy All</span></h3>
            <div id="bisac-list" class="clean-list"></div>
        </div>

        <div class="card">
            <h3>Viral Titles <span class="copy-btn" onclick="copyText('title-list')">Copy All</span></h3>
            <div id="title-list" class="clean-list"></div>
        </div>

        <div class="card" style="grid-column: 1 / -1;">
            <h3>Freedom Shortcut Blurb <span class="copy-btn" onclick="copyText('blurb-text')">Copy</span></h3>
            <div id="blurb-text" style="white-space: pre-wrap; line-height: 1.6; color: #cbd5e1;"></div>
        </div>
        
        <div class="card" style="grid-column: 1 / -1;">
            <h3>Polished Excerpt <span class="copy-btn" onclick="copyText('polish-text')">Copy</span></h3>
            <div id="polish-text" style="white-space: pre-wrap; line-height: 1.6; color: #cbd5e1;"></div>
        </div>

        <div class="card" style="grid-column: 1 / -1; text-align: center;">
            <button onclick="generateCover()" style="background: transparent; border: 1px solid var(--accent); color: var(--accent);">Generate Cover Art</button>
            <div id="cover-area" style="margin-top: 15px;"></div>
        </div>

    </div>

    <script>
        async function runAnalysis() {
            const text = document.getElementById('textInput').value;
            if(!text) return alert("Paste text first");

            document.getElementById('dashboard').style.display = 'none';
            document.getElementById('loader').style.display = 'block';
            document.getElementById('runBtn').disabled = true;

            const res = await fetch('/', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'analyze', text: text })
            });
            const data = await res.json();

            // RENDER LISTS (Split by newlines for cleaner UI)
            renderList('kw-list', data.keywords);
            renderList('bisac-list', data.bisac);
            renderList('title-list', data.titles);
            
            // RENDER TEXT BLOCKS
            document.getElementById('blurb-text').innerText = data.blurb;
            document.getElementById('polish-text').innerText = data.polish;

            document.getElementById('loader').style.display = 'none';
            document.getElementById('dashboard').style.display = 'grid';
            document.getElementById('runBtn').disabled = false;
        }

        function renderList(elementId, textData) {
            const lines = textData.split('\\n').filter(line => line.trim() !== '');
            const html = lines.map(line => \`<div onclick="copyTag(this)">\${line.trim()}</div>\`).join('');
            document.getElementById(elementId).innerHTML = html;
        }

        async function generateCover() {
            const text = document.getElementById('textInput').value;
            const area = document.getElementById('cover-area');
            area.innerHTML = 'Designing...';
            const res = await fetch('/', { method: 'POST', body: JSON.stringify({ action: 'cover', text: text }) });
            const data = await res.json();
            const url = \`https://image.pollinations.ai/prompt/\${encodeURIComponent(data.prompt)}?width=768&height=1152&model=flux&nologo=true\`;
            area.innerHTML = \`<img src="\${url}" style="max-width:100%; border-radius:8px;"><br><a href="\${url}" target="_blank" style="color:#fff; display:block; margin-top:5px;">Download</a>\`;
        }

        function copyTag(el) {
            navigator.clipboard.writeText(el.innerText);
            el.style.background = '#10b981';
            setTimeout(() => el.style.background = '', 400);
        }
        function copyText(id) {
            const text = document.getElementById(id).innerText;
            navigator.clipboard.writeText(text);
            alert("Copied!");
        }
    </script>
</body>
</html>
`;
