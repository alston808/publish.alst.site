/**
 * CLOUDFLARE WORKER: THE COMPLETE AUTHOR OS
 * Features: Formatting, SEO (KD Spy), Blurbs (Freedom Shortcut), Editing, and AI COVER ART.
 */

// 1. CONFIGURATION
const MODEL_ID = "openrouter/free"; 
const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

// 2. AI PERSONAS (The Brains)
const PROMPTS = {
  default: `
    You are an expert eBook formatting assistant for Draft2Digital.
    CORE RULES:
    - Headings: Bold+Larger OR "Heading 1" style.
    - Scene Breaks: 2-3 hard returns (*** or centered icon).
    - Page Breaks: 4+ hard returns = Chapter Break.
    - Images: 300 DPI recommended, Inline with Text.
    Answer formatting questions or format pasted text.`,

  keywords: `
    You are an Amazon KDP & Draft2Digital SEO Strategist.
    Use the "KD Spy" method to find high-traffic, low-competition keywords.
    OUTPUT:
    1. 7 "Long-Tail" Keywords (phrases 3-5 words long).
    2. 3 BISAC Categories (Specific, not general).
    3. A "Subtitle Strategy": A subtitle combining 2 main keywords.`,

  blurb: `
    You are a Copywriting Expert specializing in the "Freedom Shortcut" method.
    Write a description that triggers a psychological desire to buy.
    STRUCTURE:
    1. THE HOOK: Disrupt the reader's scrolling.
    2. THE STRUGGLE: Validate the pain/conflict.
    3. THE TURN: Hint at the solution/twist without spoilers.
    4. THE CTA: Command them to buy.
    Tone: Urgent, intriguing.`,

  titles: `
    You are a Viral Title Consultant.
    Generate 10 title/subtitle pairs using:
    - The "How-To" Promise.
    - The Contrarian Statement.
    - The Specific Result.
    - The Metaphor.`,

  polish: `
    You are a Ruthless Editor.
    Fix "Show, Don't Tell" issues.
    - Remove filter words (felt, saw, heard).
    - Kill adverbs.
    - Fix pacing.
    Output the polished version first.`,

  // NEW: The Art Director Persona
  cover_art: `
    You are a Professional AI Art Director for Book Covers.
    Your job is NOT to chat, but to generate a "Stable Diffusion" image prompt based on the user's book concept.
    
    RULES:
    1. Analyze the user's genre (Thriller, Romance, Sci-Fi).
    2. Create a visual description including: Subject, Lighting, Art Style (Oil painting, Hyper-realism, Vector), and Mood.
    3. KEYWORD STUFFING: Use words like "Cinematic, 8k, Detailed, Dramatic Lighting, Masterpiece".
    4. ASPECT RATIO: Ensure the composition fits a vertical book cover.
    5. TEXT WARNING: Do NOT ask for text on the image (AI handles text poorly). Focus on the artwork.
    
    OUTPUT FORMAT:
    Just return the raw prompt text. No "Here is your prompt". just the prompt.
    Example: "A dark fantasy castle on a hill, lightning storm, oil painting style, greg rutkowski, dramatic, 8k"`
};

// 3. THE HTML UI (Frontend)
const html = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
    <title>Author OS</title>
    <style>
        :root { --bg: #0f172a; --card: #1e293b; --text: #f1f5f9; --accent: #8b5cf6; --accent-hover: #7c3aed; --border: #334155; }
        * { box-sizing: border-box; }
        body { font-family: -apple-system, system-ui, sans-serif; background: var(--bg); color: var(--text); margin: 0; padding: 0; display: flex; flex-direction: column; height: 100vh; }
        
        header { background: var(--card); padding: 15px; border-bottom: 1px solid var(--border); display: flex; flex-direction: column; gap: 10px; box-shadow: 0 4px 10px rgba(0,0,0,0.3); }
        h1 { margin: 0; font-size: 1.2rem; text-align: center; color: #fff; font-weight: 800; letter-spacing: 1px; }
        
        .controls { display: grid; grid-template-columns: 1fr auto; gap: 8px; }
        select { background: #0f172a; color: white; border: 1px solid var(--border); padding: 12px; border-radius: 8px; font-size: 1rem; width: 100%; outline: none; appearance: none; background-image: url("data:image/svg+xml;charset=US-ASCII,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%22292.4%22%20height%3D%22292.4%22%3E%3Cpath%20fill%3D%22%23FFFFFF%22%20d%3D%22M287%2069.4a17.6%2017.6%200%200%200-13-5.4H18.4c-5%200-9.3%201.8-12.9%205.4A17.6%2017.6%200%200%200%200%2082.2c0%205%201.8%209.3%205.4%2012.9l128%20127.9c3.6%203.6%207.8%205.4%2012.8%205.4s9.2-1.8%2012.8-5.4L287%2095c3.5-3.5%205.4-7.8%205.4-12.8%200-5-1.9-9.2-5.5-12.8z%22%2F%3E%3C%2Fsvg%3E"); background-repeat: no-repeat; background-position: right .7em top 50%; background-size: .65em auto; }
        
        .file-upload { position: relative; overflow: hidden; display: inline-block; }
        .file-upload input[type=file] { position: absolute; left: 0; top: 0; opacity: 0; width: 100%; height: 100%; cursor: pointer; }
        .icon-btn { background: var(--card); border: 1px solid var(--border); color: var(--text); padding: 0 15px; border-radius: 8px; display: flex; align-items: center; justify-content: center; height: 100%; font-size: 1.2rem; cursor: pointer; }
        
        #chat-container { flex: 1; overflow-y: auto; padding: 15px; display: flex; flex-direction: column; gap: 15px; scroll-behavior: smooth; }
        .message { max-width: 90%; padding: 16px; border-radius: 12px; line-height: 1.6; font-size: 15px; position: relative; word-wrap: break-word; }
        .user { align-self: flex-end; background: var(--accent); color: white; border-bottom-right-radius: 2px; box-shadow: 0 4px 6px rgba(0,0,0,0.2); }
        .ai { align-self: flex-start; background: var(--card); border: 1px solid var(--border); border-bottom-left-radius: 2px; }
        .tag { font-size: 0.7rem; text-transform: uppercase; letter-spacing: 1px; color: #94a3b8; margin-bottom: 6px; display: block; font-weight: bold; }
        
        /* Image Generation Styling */
        .generated-image-container { margin-top: 10px; border-radius: 8px; overflow: hidden; border: 1px solid var(--border); }
        .generated-image { width: 100%; height: auto; display: block; }
        .download-link { display: block; text-align: center; background: #333; padding: 8px; color: white; text-decoration: none; font-size: 0.9rem; font-weight: bold; }

        #input-area { background: var(--card); padding: 12px; display: flex; gap: 10px; border-top: 1px solid var(--border); padding-bottom: max(12px, env(safe-area-inset-bottom)); }
        textarea { flex: 1; background: #0f172a; border: 1px solid var(--border); color: white; padding: 12px; border-radius: 8px; resize: none; height: 50px; font-family: inherit; font-size: 16px; outline: none; }
        textarea:focus { border-color: var(--accent); }
        
        button#sendBtn { background: var(--accent); border: none; color: white; padding: 0 20px; border-radius: 8px; font-weight: bold; cursor: pointer; transition: background 0.2s; }
        button#sendBtn:active { background: var(--accent-hover); transform: scale(0.98); }
        button:disabled { opacity: 0.6; cursor: not-allowed; }
        
        .spinner { width: 20px; height: 20px; border: 3px solid rgba(255,255,255,0.3); border-radius: 50%; border-top-color: #fff; animation: spin 0.8s ease-in-out infinite; margin: auto; }
        @keyframes spin { to { transform: rotate(360deg); } }
    </style>
</head>
<body>
    <header>
        <h1>Publish AI</h1>
        <div class="controls">
            <select id="modeSelector">
                <option value="default">📘 Formatting Helper</option>
                <option value="keywords">🔍 SEO & Categories</option>
                <option value="blurb">📢 Blurb (Freedom Shortcut)</option>
                <option value="titles">🏷️ Viral Titles</option>
                <option value="polish">✨ Editor (Show Don't Tell)</option>
                <option value="cover_art">🎨 AI Cover Art Generator</option>
            </select>
            <div class="file-upload">
                <button class="icon-btn" title="Upload Chapter">📂</button>
                <input type="file" id="fileInput" accept=".txt,.md,.csv,.html">
            </div>
        </div>
    </header>

    <div id="chat-container">
        <div class="message ai">
            <span class="tag">System</span>
            Welcome to Publish AI. Select a tool above.<br><br>
            <b>New Feature:</b> Select 🎨 <b>AI Cover Art</b> and describe your book to generate free, royalty-free cover concepts instantly.
        </div>
    </div>

    <div id="input-area">
        <textarea id="userInput" placeholder="Type here..."></textarea>
        <button id="sendBtn" onclick="sendMessage()">Send</button>
    </div>

    <script>
        const chat = document.getElementById('chat-container');
        const input = document.getElementById('userInput');
        const btn = document.getElementById('sendBtn');
        const modeSelector = document.getElementById('modeSelector');
        const fileInput = document.getElementById('fileInput');

        fileInput.addEventListener('change', async (e) => {
            const file = e.target.files[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = function(e) {
                input.value = e.target.result.substring(0, 15000); 
                input.style.height = "150px";
                input.focus();
            };
            reader.readAsText(file);
        });

        async function sendMessage() {
            const text = input.value.trim();
            const mode = modeSelector.value;
            if (!text) return;

            // User Message
            appendMessage(text, 'user', 'You');
            input.value = '';
            input.style.height = "50px"; 
            btn.disabled = true;
            btn.innerHTML = '<div class="spinner"></div>';

            try {
                const response = await fetch('/', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ message: text, mode: mode })
                });
                
                const data = await response.json();
                const toolName = modeSelector.options[modeSelector.selectedIndex].text;
                
                if (mode === 'cover_art') {
                    // Handle Image Generation
                    appendImageMessage(data.reply, toolName);
                } else {
                    // Handle Text Generation
                    let formattedReply = data.reply
                        .replace(/\\*\\*(.*?)\\*\\*/g, '<strong>$1</strong>')
                        .replace(/### (.*?)\\n/g, '<h3>$1</h3>')
                        .replace(/\\n/g, '<br>');
                    appendMessage(formattedReply, 'ai', toolName);
                }
            } catch (e) {
                appendMessage("Error: " + e.message, 'ai', 'System');
            }

            btn.disabled = false;
            btn.innerText = 'Send';
        }

        function appendMessage(htmlContent, type, label) {
            const div = document.createElement('div');
            div.className = 'message ' + type;
            div.innerHTML = '<span class="tag">' + label + '</span>' + htmlContent;
            chat.appendChild(div);
            chat.scrollTop = chat.scrollHeight;
        }

        function appendImageMessage(prompt, label) {
            const div = document.createElement('div');
            div.className = 'message ai';
            
            // Generate URL for Pollinations.ai (Free, Open Source Models)
            // We use vertical aspect ratio (width 768, height 1152) standard for books
            const encodedPrompt = encodeURIComponent(prompt);
            const imageUrl = \`https://image.pollinations.ai/prompt/\${encodedPrompt}?width=768&height=1152&nologo=true&model=flux\`;

            div.innerHTML = \`
                <span class="tag">\${label}</span>
                Here is a cover concept based on: "<em>\${prompt}</em>"<br>
                <div class="generated-image-container">
                    <img src="\${imageUrl}" class="generated-image" alt="AI Generated Cover" onload="this.scrollIntoView({behavior:'smooth'})">
                    <a href="\${imageUrl}" target="_blank" class="download-link">Download High Res</a>
                </div>
            \`;
            chat.appendChild(div);
        }
    </script>
</body>
</html>
`;

// 4. WORKER LOGIC
export default {
  async fetch(request, env) {
    if (request.method === "OPTIONS") return new Response(null, { headers: CORS_HEADERS });
    if (request.method === "GET") return new Response(html, { headers: { "Content-Type": "text/html", ...CORS_HEADERS } });

    if (request.method === "POST") {
      try {
        const { message, mode } = await request.json();
        const systemPrompt = PROMPTS[mode] || PROMPTS.default;

        const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${env.OPENROUTER_API_KEY}`,
            "Content-Type": "application/json",
            "HTTP-Referer": "https://publish.alst.site",
            "X-Title": "Publish AI"
          },
          body: JSON.stringify({
            model: MODEL_ID,
            messages: [
              { role: "system", content: systemPrompt },
              { role: "user", content: message }
            ]
          })
        });

        const data = await response.json();
        const reply = data.choices?.[0]?.message?.content || "No response.";
        return new Response(JSON.stringify({ reply }), { headers: { "Content-Type": "application/json", ...CORS_HEADERS } });

      } catch (err) {
        return new Response(JSON.stringify({ reply: "Error: " + err.message }), { headers: CORS_HEADERS });
      }
    }
    return new Response("Method not allowed", { status: 405 });
  },
};