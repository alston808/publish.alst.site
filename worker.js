/**
 * CLOUDFLARE WORKER: AUTHOR COMMAND CENTER v2
 * Features: Live Research (Serper), Parallel AI, BSR Analysis
 */

// CONFIGURATION
const MODEL_ID = "openrouter/free"; 
const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

// 1. LEGACY LISTENER (Node 14 Compatible)
addEventListener("fetch", event => {
  event.respondWith(handleRequest(event.request));
});

// 2. MAIN REQUEST HANDLER
async function handleRequest(request) {
  if (request.method === "OPTIONS") return new Response(null, { headers: CORS_HEADERS });
  if (request.method === "GET") return new Response(HTML_UI, { headers: { "Content-Type": "text/html", ...CORS_HEADERS } });

  if (request.method === "POST") {
    try {
      const { action, text } = await request.json();

      // Individual Tools
      if (action === "cover") {
        const prompt = await generateCoverPrompt(text);
        return new Response(JSON.stringify({ prompt }), { headers: { "Content-Type": "application/json", ...CORS_HEADERS } });
      }

      // MAIN: Run All Tools Concurrently
      if (action === "analyze") {
        // Run standard AI tasks + Live Research in parallel
        const [seo, titles, blurb, polish, research] = await Promise.all([
          simpleAI("seo", text),
          simpleAI("titles", text),
          advancedLoop("blurb", text),
          advancedLoop("polish", text),
          runMarketResearch(text) // NEW: Live Internet Search
        ]);

        return new Response(JSON.stringify({ seo, titles, blurb, polish, research }), { 
          headers: { "Content-Type": "application/json", ...CORS_HEADERS } 
        });
      }

    } catch (err) {
      return new Response(JSON.stringify({ error: err.message }), { 
        headers: { "Content-Type": "application/json", ...CORS_HEADERS } 
      });
    }
  }
  return new Response("Method not allowed", { status: 405 });
}

// ---------------------------------------------------------
// 3. NEW: MARKET RESEARCH AGENT (Live Search)
// ---------------------------------------------------------
async function runMarketResearch(text) {
  // 1. Ask AI to generate a search query based on the book snippet
  const queryPrompt = `Based on this text, write a single Google search query to find competitor best sellers on Amazon. 
  Example output: "Amazon best sellers cyber thriller books"
  Input: ${text.substring(0, 500)}`;
  const searchQuery = await callOpenRouter("You are a Search Engineer.", queryPrompt);

  // 2. Perform Live Google Search (via Serper)
  let searchResults = "";
  try {
    searchResults = await fetchGoogleResults(searchQuery);
  } catch (e) {
    searchResults = "Search unavailable (Key missing). Using internal AI knowledge.";
  }

  // 3. Analyze Results for BSR and Trends
  const analysisPrompt = `
    ACT AS: A Senior Market Analyst for Amazon KDP.
    CONTEXT: Here are live Google search results for the user's genre:
    ${searchResults}

    TASK: Analyze these results and the user's text to provide:
    1. **Competition Level**: (Low/Medium/High) based on the titles found.
    2. **BSR Target**: Estimate the Amazon Best Seller Rank needed to break Top 100 (e.g., "You need BSR < 5,000").
    3. **Reader Expectations**: What tropes/keywords are visible in the top results?
    4. **Gap Analysis**: What is missing in the current top books that the user's book provides?
    
    OUTPUT FORMAT: Bullet points. Be specific.
  `;
  
  return await callOpenRouter("You are a Market Analyst.", analysisPrompt);
}

// Helper: Fetch from Serper.dev (Google Search API)
async function fetchGoogleResults(query) {
  // Check if key exists (Dashboard variable)
  if (typeof SERPER_API_KEY === 'undefined' || !SERPER_API_KEY) {
    return "Error: No SERPER_API_KEY found. Please add it to Cloudflare Variables.";
  }

  const response = await fetch("https://google.serper.dev/search", {
    method: "POST",
    headers: {
      "X-API-KEY": SERPER_API_KEY,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ q: query, num: 5 }) // Get top 5 results
  });

  const data = await response.json();
  // Extract useful snippets
  return data.organic.map(r => `- Title: ${r.title}\n  Snippet: ${r.snippet}`).join("\n\n");
}

// ---------------------------------------------------------
// 4. EXISTING AI LOGIC
// ---------------------------------------------------------
async function simpleAI(mode, input) {
  return await callOpenRouter(PROMPTS[mode], input);
}

async function advancedLoop(mode, input) {
  const draft = await callOpenRouter(PROMPTS[mode + "_draft"], input);
  const critiquePrompt = `CRITIQUE this text. Find 3 weak points. TEXT: "${draft}"`;
  const critique = await callOpenRouter("You are a critic.", critiquePrompt);
  const finalPrompt = `REWRITE this based on critique: ${critique}. ORIGINAL: ${draft}`;
  return await callOpenRouter("You are an expert writer.", finalPrompt);
}

async function generateCoverPrompt(input) {
  const prompt = `Create a stable diffusion prompt for this book cover. Genre, Subject, Art Style.`;
  return await callOpenRouter("You are an AI Art Director.", input.substring(0, 1000));
}

async function callOpenRouter(system, user) {
  const apiKey = OPENROUTER_API_KEY; // Must be set in Dashboard
  const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "HTTP-Referer": "https://cloudflare-worker.com",
      "X-Title": "BookDashboard"
    },
    body: JSON.stringify({
      model: MODEL_ID,
      messages: [{ role: "system", content: system }, { role: "user", content: user.substring(0, 15000) }]
    })
  });
  const data = await response.json();
  return data.choices?.[0]?.message?.content || "AI Error";
}

const PROMPTS = {
  seo: `Analyze text. Output 15 Amazon KDP Keywords (Short & Long tail), comma-separated.`,
  titles: `Generate 5 Viral Titles & Subtitles. Hook-driven. Bullet points.`,
  blurb_draft: `Write a Book Blurb: Hook -> Conflict -> Stakes. Urgent tone.`,
  polish_draft: `Rewrite first 500 words. Show Don't Tell. Strong verbs.`
};

// ---------------------------------------------------------
// 5. UPDATED UI (HTML)
// ---------------------------------------------------------
const HTML_UI = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0">
    <title>Author Command Center</title>
    <style>
        :root { --bg: #0f172a; --card: #1e293b; --text: #e2e8f0; --accent: #3b82f6; --green: #10b981; --purple: #8b5cf6; }
        * { box-sizing: border-box; }
        body { font-family: -apple-system, system-ui, sans-serif; background: var(--bg); color: var(--text); padding: 15px; margin: 0; }
        h1 { text-align: center; margin-bottom: 20px; }
        
        .input-box { background: var(--card); padding: 15px; border-radius: 12px; border: 1px solid #334155; margin-bottom: 20px; }
        textarea { width: 100%; height: 120px; background: #020617; color: white; border: 1px solid #334155; border-radius: 8px; padding: 10px; resize: none; }
        
        #launchBtn { width: 100%; background: linear-gradient(135deg, var(--accent), #2563eb); color: white; border: none; padding: 15px; border-radius: 8px; font-weight: bold; cursor: pointer; margin-top: 10px; }
        #launchBtn:disabled { opacity: 0.6; cursor: wait; }

        .grid { display: grid; grid-template-columns: 1fr; gap: 15px; display: none; }
        @media(min-width: 768px) { .grid { grid-template-columns: 1fr 1fr; } }
        
        .card { background: var(--card); border: 1px solid #334155; border-radius: 12px; padding: 15px; display: flex; flex-direction: column; }
        .card h3 { margin: 0 0 10px 0; font-size: 1rem; color: var(--accent); display: flex; justify-content: space-between; }
        
        .research-card { border-color: var(--purple); background: #2e1065; }
        .research-card h3 { color: #c4b5fd; }

        .copy-icon { background: #334155; padding: 4px 8px; border-radius: 4px; cursor: pointer; color: white; border: none; font-size: 0.8rem; }
        .content { font-size: 0.95rem; line-height: 1.6; white-space: pre-wrap; color: #cbd5e1; }
        
        .tags { display: flex; flex-wrap: wrap; gap: 8px; }
        .tag { background: #0f172a; border: 1px solid #334155; padding: 5px 10px; border-radius: 20px; font-size: 0.85rem; cursor: pointer; }

        .loader { text-align: center; margin: 20px 0; display: none; }
        .spinner { display: inline-block; width: 25px; height: 25px; border: 3px solid rgba(255,255,255,0.3); border-radius: 50%; border-top-color: var(--accent); animation: spin 0.8s infinite; }
        @keyframes spin { to { transform: rotate(360deg); } }
    </style>
</head>
<body>

    <h1>Author Command Center</h1>

    <div class="input-box">
        <textarea id="textInput" placeholder="Paste your chapter, notes, or concept here..."></textarea>
        <button id="launchBtn" onclick="runDashboard()">🚀 Run Launch Engine (+ Live Research)</button>
    </div>

    <div id="loader" class="loader">
        <div class="spinner"></div>
        <p>Scanning Amazon BSR, Drafting, Critiquing...</p>
    </div>

    <div id="dashboard" class="grid">
        <div class="card research-card" style="grid-column: 1 / -1;">
            <h3>📊 Live Market Research & BSR <button class="copy-icon" onclick="copyText('researchOutput')">Copy</button></h3>
            <div id="researchOutput" class="content"></div>
        </div>

        <div class="card">
            <h3>SEO Keywords <button class="copy-icon" onclick="copyAllTags()">Copy All</button></h3>
            <div id="seoOutput" class="tags"></div>
        </div>

        <div class="card">
            <h3>Viral Titles <button class="copy-icon" onclick="copyText('titlesOutput')">Copy</button></h3>
            <div id="titlesOutput" class="content"></div>
        </div>

        <div class="card" style="grid-column: 1 / -1;">
            <h3>Master Blurb <button class="copy-icon" onclick="copyText('blurbOutput')">Copy</button></h3>
            <div id="blurbOutput" class="content"></div>
        </div>

        <div class="card" style="grid-column: 1 / -1;">
            <h3>Polished Excerpt <button class="copy-icon" onclick="copyText('polishOutput')">Copy</button></h3>
            <div id="polishOutput" class="content"></div>
        </div>

        <div class="card" style="grid-column: 1 / -1; align-items: center;">
            <h3>Cover Art</h3>
            <button style="background:transparent; border:1px solid var(--accent); color:var(--accent); padding:8px 16px; border-radius:6px; cursor:pointer;" onclick="generateCover()">🎨 Generate Cover</button>
            <div id="coverArea" style="margin-top:10px; text-align:center;"></div>
        </div>
    </div>

    <script>
        async function runDashboard() {
            const text = document.getElementById('textInput').value;
            if (!text) return alert("Please enter text.");

            document.getElementById('dashboard').style.display = 'none';
            document.getElementById('loader').style.display = 'block';
            document.getElementById('launchBtn').disabled = true;

            try {
                const res = await fetch('/', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ action: 'analyze', text: text })
                });
                const data = await res.json();
                
                if (data.error) throw new Error(data.error);

                // Render Results
                document.getElementById('researchOutput').innerText = data.research; // Research result
                document.getElementById('titlesOutput').innerText = data.titles;
                document.getElementById('blurbOutput').innerText = data.blurb;
                document.getElementById('polishOutput').innerText = data.polish;

                const tags = data.seo.split(',').map(t => t.trim());
                document.getElementById('seoOutput').innerHTML = tags.map(tag => \`<span class="tag" onclick="copyTag(this)">\${tag}</span>\`).join('');

                document.getElementById('loader').style.display = 'none';
                document.getElementById('dashboard').style.display = 'grid';

            } catch (e) {
                alert("Error: " + e.message);
                document.getElementById('loader').style.display = 'none';
            }
            document.getElementById('launchBtn').disabled = false;
        }

        async function generateCover() {
            const text = document.getElementById('textInput').value;
            const area = document.getElementById('coverArea');
            area.innerHTML = 'Designing...';
            const res = await fetch('/', {
                method: 'POST',
                body: JSON.stringify({ action: 'cover', text: text })
            });
            const data = await res.json();
            const url = \`https://image.pollinations.ai/prompt/\${encodeURIComponent(data.prompt)}?width=768&height=1152&model=flux&nologo=true\`;
            area.innerHTML = \`<img src="\${url}" style="max-width:100%; border-radius:8px; box-shadow:0 4px 12px rgba(0,0,0,0.5);"><br><a href="\${url}" target="_blank" style="color:#3b82f6; display:block; margin-top:10px;">Download</a>\`;
        }

        function copyTag(el) { navigator.clipboard.writeText(el.innerText); el.style.background = '#10b981'; }
        function copyAllTags() { navigator.clipboard.writeText(Array.from(document.querySelectorAll('.tag')).map(t => t.innerText).join(', ')); }
        function copyText(id) { navigator.clipboard.writeText(document.getElementById(id).innerText); }
    </script>
</body>
</html>
`;
