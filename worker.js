/**
 * CLOUDFLARE WORKER: THE "BOOK LAUNCH DASHBOARD"
 * Node 14 Compatible (Service Worker Syntax)
 */

// CONFIGURATION
const MODEL_ID = "openrouter/free"; 
const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

// 1. LEGACY LISTENER (Node 14 / Wrangler v1/v2 compatible)
addEventListener("fetch", event => {
  event.respondWith(handleRequest(event.request));
});

// 2. MAIN ROUTER
async function handleRequest(request) {
  if (request.method === "OPTIONS") return new Response(null, { headers: CORS_HEADERS });

  const url = new URL(request.url);

  // Serve the UI
  if (request.method === "GET") {
    return new Response(HTML_UI, { headers: { "Content-Type": "text/html", ...CORS_HEADERS } });
  }

  // Handle API Calls
  if (request.method === "POST") {
    try {
      const { text, action } = await request.json();
      
      // Route to specific AI tasks
      if (action === "analyze_all") return await generateDashboard(text);
      if (action === "generate_cover") return await generateCoverPrompt(text);

      return new Response("Invalid Action", { status: 400 });

    } catch (err) {
      return new Response(JSON.stringify({ error: err.message }), { 
        headers: { "Content-Type": "application/json", ...CORS_HEADERS } 
      });
    }
  }

  return new Response("Method not allowed", { status: 405 });
}

// 3. AI ORCHESTRATION (The "Deep Refine" Loops)
async function generateDashboard(text) {
  // We run these in parallel to speed up the dashboard generation
  const [seoData, titlesData, blurbData, polishData] = await Promise.all([
    runAI("seo", text),
    runAI("titles", text),
    runDeepRefineLoop("blurb", text), // Runs the 3-step critique loop
    runDeepRefineLoop("polish", text) // Runs the 3-step critique loop
  ]);

  return new Response(JSON.stringify({
    seo: seoData,
    titles: titlesData,
    blurb: blurbData,
    polish: polishData
  }), { headers: { "Content-Type": "application/json", ...CORS_HEADERS } });
}

// Helper: Standard Single-Shot AI Call
async function runAI(mode, input) {
  const systemPrompt = PROMPTS[mode];
  const response = await callOpenRouter(systemPrompt, input);
  return response;
}

// Helper: The "Critique & Rewrite" Loop (Draft -> Critique -> Final)
async function runDeepRefineLoop(mode, input) {
  // Step 1: Draft
  const draftPrompt = PROMPTS[mode + "_draft"];
  const draft = await callOpenRouter(draftPrompt, input);

  // Step 2: Critique & Rewrite (Combined for speed)
  const critiquePrompt = `
    You are a Harsh Editor. 
    1. CRITIQUE the following text. Find 3 weak points (boring verbs, passive voice, lack of stakes).
    2. REWRITE it into a "Version 2" that fixes these issues.
    
    TEXT TO CRITIQUE:
    ${draft}
  `;
  const v2 = await callOpenRouter("You are an editor.", critiquePrompt);

  // Step 3: Final Polish (Best of All)
  const finalPrompt = `
    You have two versions of a text.
    Version 1: ${draft}
    Version 2 (Critiqued): ${v2}

    TASK: Create the "Final Masterpiece". 
    - Combine the strongest hooks from V1.
    - Use the polished flow of V2.
    - Ensure it is perfect for the current market.
    - Output ONLY the final text. No preamble.
  `;
  const final = await callOpenRouter("You are a Best-Selling Publisher.", finalPrompt);
  
  return final;
}

async function generateCoverPrompt(input) {
  const prompt = `Analyze this book text and write a Stable Diffusion prompt for the cover. 
  Include: Subject, Art Style, Lighting, Mood. 
  Output ONLY the prompt. No chat.
  Input: ${input.substring(0, 1000)}`; // Limit input for speed
  
  const coverPrompt = await callOpenRouter("You are an AI Art Director.", prompt);
  return new Response(JSON.stringify({ prompt: coverPrompt }), { 
    headers: { "Content-Type": "application/json", ...CORS_HEADERS } 
  });
}

// 4. OPENROUTER API CALLER
async function callOpenRouter(system, user) {
  // We need to retrieve the key from the environment (Legacy way for Node 14 listener)
  // In legacy listener, global variables are available if set in Dashboard
  const apiKey = typeof OPENROUTER_API_KEY !== 'undefined' ? OPENROUTER_API_KEY : "MISSING_KEY";

  const req = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "HTTP-Referer": "https://cloudflare-worker.com",
      "X-Title": "Author Dashboard"
    },
    body: JSON.stringify({
      model: MODEL_ID,
      messages: [
        { role: "system", content: system },
        { role: "user", content: user }
      ]
    })
  });
  
  const data = await req.json();
  return data.choices?.[0]?.message?.content || "AI Error";
}

// 5. PROMPT LIBRARY
const PROMPTS = {
  seo: `
    Analyze the text. Output JSON ONLY with this format:
    {
      "keywords": ["tag1", "tag2", "tag3", "tag4", "tag5", "tag6", "tag7"],
      "categories": ["BISAC1", "BISAC2", "BISAC3"]
    }
    Focus on high-traffic, low-competition keywords (KD Spy method).
  `,
  titles: `
    Generate 5 viral title options based on the text.
    Format: "Title: Subtitle"
    Output as a simple bulleted list.
  `,
  // Blurb Loop Prompts
  blurb_draft: `
    Write a "Freedom Shortcut" style book blurb.
    Structure: Hook -> Struggle -> Solution -> CTA.
    Make it emotional and punchy.
  `,
  // Polish Loop Prompts
  polish_draft: `
    Rewrite the first 300 words of the input to improve "Author Voice".
    Focus on "Show, Don't Tell". Remove filter words.
  `
};

// 6. THE DASHBOARD UI (HTML/CSS/JS)
const HTML_UI = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Book Launch Dashboard</title>
    <style>
        :root { --bg: #0f172a; --card: #1e293b; --text: #f8fafc; --accent: #8b5cf6; --success: #10b981; }
        body { font-family: system-ui, sans-serif; background: var(--bg); color: var(--text); margin: 0; padding: 20px; }
        
        /* Layout */
        .container { max-width: 1000px; margin: 0 auto; display: grid; gap: 20px; }
        
        /* Input Section */
        .input-card { background: var(--card); padding: 20px; border-radius: 12px; border: 1px solid #334155; }
        textarea { width: 100%; height: 150px; background: #020617; border: 1px solid #334155; color: white; padding: 10px; border-radius: 8px; resize: vertical; margin-bottom: 10px; font-family: monospace; }
        
        /* Buttons */
        .btn { background: var(--accent); color: white; border: none; padding: 12px 24px; border-radius: 8px; font-weight: bold; cursor: pointer; font-size: 1rem; width: 100%; transition: transform 0.1s; }
        .btn:active { transform: scale(0.98); }
        .btn:disabled { opacity: 0.5; cursor: wait; }
        .btn-outline { background: transparent; border: 1px solid var(--accent); color: var(--accent); margin-top: 10px; }

        /* Dashboard Grid */
        .dashboard { display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 20px; margin-top: 20px; display: none; }
        .result-card { background: var(--card); padding: 20px; border-radius: 12px; border: 1px solid #334155; position: relative; }
        .card-header { font-weight: bold; color: var(--accent); margin-bottom: 15px; border-bottom: 1px solid #334155; padding-bottom: 10px; display: flex; justify-content: space-between; }
        
        /* Tags styling */
        .tag-cloud { display: flex; flex-wrap: wrap; gap: 8px; }
        .tag { background: #334155; padding: 5px 10px; border-radius: 4px; font-size: 0.9rem; cursor: pointer; transition: background 0.2s; }
        .tag:hover { background: var(--accent); }
        
        /* Copy Utilities */
        .copy-btn { background: #334155; border: none; color: white; padding: 4px 8px; border-radius: 4px; font-size: 0.8rem; cursor: pointer; }
        .copy-btn:active { background: var(--success); }

        /* Cover Art Section */
        #cover-section { text-align: center; display: none; margin-top: 20px; }
        .cover-img { max-width: 100%; border-radius: 8px; box-shadow: 0 4px 15px rgba(0,0,0,0.5); margin-top: 15px; }

        .spinner { display: inline-block; width: 20px; height: 20px; border: 3px solid rgba(255,255,255,0.3); border-radius: 50%; border-top-color: #fff; animation: spin 1s infinite; }
        @keyframes spin { to { transform: rotate(360deg); } }
    </style>
</head>
<body>

<div class="container">
    <header style="text-align: center; margin-bottom: 20px;">
        <h1>🚀 Book Launch Dashboard</h1>
        <p style="color: #94a3b8;">Paste your chapter once. Get everything.</p>
    </header>

    <div class="input-card">
        <textarea id="bookInput" placeholder="Paste your chapter, notes, or rough draft here..."></textarea>
        <button id="generateBtn" class="btn" onclick="runAnalysis()">Generate Dashboard</button>
    </div>

    <div id="dashboard" class="dashboard">
        
        <div class="result-card">
            <div class="card-header">
                🔍 SEO Keywords 
                <button class="copy-btn" onclick="copyAllTags()">Copy All</button>
            </div>
            <div id="seo-results" class="tag-cloud">Loading...</div>
        </div>

        <div class="result-card">
            <div class="card-header">🏷️ Viral Titles</div>
            <div id="title-results" style="white-space: pre-line;">Loading...</div>
        </div>

        <div class="result-card" style="grid-column: 1 / -1;">
            <div class="card-header">
                📢 Masterpiece Blurb (3x Refined)
                <button class="copy-btn" onclick="copyText('blurb-text')">Copy</button>
            </div>
            <div id="blurb-text" style="white-space: pre-line; color: #cbd5e1; line-height: 1.6;">Generating...</div>
        </div>

        <div class="result-card" style="grid-column: 1 / -1;">
            <div class="card-header">
                ✨ Polished Text (Critiqued & Rewritten)
                <button class="copy-btn" onclick="copyText('polish-text')">Copy</button>
            </div>
            <div id="polish-text" style="white-space: pre-line; color: #cbd5e1; line-height: 1.6;">Polishing...</div>
        </div>

        <div class="result-card" style="grid-column: 1 / -1; text-align: center;">
            <div class="card-header" style="justify-content: center;">🎨 Cover Art</div>
            <p style="font-size: 0.9rem; color: #94a3b8;">Save credits/time. Only generate if needed.</p>
            <button class="btn btn-outline" onclick="generateCover()">Generate Free Cover Art</button>
            <div id="cover-section"></div>
        </div>

    </div>
</div>

<script>
    async function runAnalysis() {
        const text = document.getElementById('bookInput').value;
        if (!text) return alert("Please enter some text!");

        // Show UI
        document.getElementById('dashboard').style.display = 'grid';
        document.getElementById('generateBtn').disabled = true;
        document.getElementById('generateBtn').innerHTML = '<div class="spinner"></div> Processing...';

        try {
            const res = await fetch('/', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'analyze_all', text: text })
            });
            const data = await res.json();

            // Populate SEO
            const seoDiv = document.getElementById('seo-results');
            try {
                // Remove Markdown code blocks if AI added them
                const cleanJson = data.seo.replace(/\\\`\\\`\\\`json/g, '').replace(/\\\`\\\`\\\`/g, '');
                const seoObj = JSON.parse(cleanJson);
                seoDiv.innerHTML = seoObj.keywords.map(k => \`<span class="tag" onclick="copyTag(this)">\${k}</span>\`).join('');
            } catch(e) { seoDiv.innerText = data.seo; }

            // Populate Text Fields
            document.getElementById('title-results').innerText = data.titles;
            document.getElementById('blurb-text').innerText = data.blurb;
            document.getElementById('polish-text').innerText = data.polish;

        } catch (e) {
            alert("Error: " + e.message);
        }

        document.getElementById('generateBtn').disabled = false;
        document.getElementById('generateBtn').innerText = 'Generate Dashboard';
    }

    async function generateCover() {
        const text = document.getElementById('bookInput').value;
        const coverDiv = document.getElementById('cover-section');
        coverDiv.style.display = 'block';
        coverDiv.innerHTML = '<div class="spinner"></div> designing...';

        try {
            const res = await fetch('/', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'generate_cover', text: text })
            });
            const data = await res.json();
            
            // Use Pollinations for instant image
            const encodedPrompt = encodeURIComponent(data.prompt);
            const imgUrl = \`https://image.pollinations.ai/prompt/\${encodedPrompt}?width=768&height=1152&model=flux&nologo=true\`;
            
            coverDiv.innerHTML = \`<img src="\${imgUrl}" class="cover-img" alt="Cover"><br><a href="\${imgUrl}" target="_blank" style="color:white; display:block; margin-top:10px;">Download HD</a>\`;

        } catch (e) {
            coverDiv.innerText = "Error creating cover.";
        }
    }

    // Copy Utilities
    function copyTag(el) {
        navigator.clipboard.writeText(el.innerText);
        const original = el.style.background;
        el.style.background = '#10b981';
        setTimeout(() => el.style.background = '', 500);
    }

    function copyAllTags() {
        const tags = Array.from(document.querySelectorAll('.tag')).map(t => t.innerText).join(', ');
        navigator.clipboard.writeText(tags);
        alert("All tags copied!");
    }

    function copyText(id) {
        const text = document.getElementById(id).innerText;
        navigator.clipboard.writeText(text);
        alert("Text copied!");
    }
</script>

</body>
</html>
`;
