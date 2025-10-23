import express from "express";
import axios from "axios";
import * as cheerio from "cheerio";
import chalk from "chalk";
import https from "https";

const app = express();
app.use(express.json());
const PORT = process.env.PORT || 3000;
const ENV = process.env.NODE_ENV || 'development';
const IS_VERCEL = !!process.env.VERCEL;

const log = {
  info: (msg) => console.log(IS_VERCEL ? `[INFO] ${msg}` : chalk.cyan(`ℹ️ [INFO] ${new Date().toISOString()} - ${msg}`)),
  success: (msg) => console.log(IS_VERCEL ? `[SUCCESS] ${msg}` : chalk.green(`✅ [SUCCESS] ${new Date().toISOString()} - ${msg}`)),
  error: (msg) => console.log(IS_VERCEL ? `[ERROR] ${msg}` : chalk.red(`❌ [ERROR] ${new Date().toISOString()} - ${msg}`)),
};

app.use((req, res, next) => { log.info(`📡 ${req.method} ${req.url}`); next(); });

const css = `*{margin:0;padding:0;box-sizing:border-box}body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#0f172a;color:#e2e8f0;min-height:100vh;padding:20px}.container{max-width:1100px;margin:0 auto}header{text-align:center;padding:25px 0;margin-bottom:25px}h1{font-size:clamp(24px,5vw,34px);font-weight:700;background:linear-gradient(135deg,#667eea,#764ba2);-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text}.badge{display:inline-block;padding:5px 12px;background:rgba(102,126,234,0.15);border:1px solid rgba(102,126,234,0.3);border-radius:15px;font-size:11px;margin-left:8px;font-weight:600;color:#667eea}.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(240px,1fr));gap:14px}.card{background:rgba(30,41,59,0.5);border:1px solid rgba(102,126,234,0.15);border-radius:10px;padding:16px;cursor:pointer;transition:all 0.2s;margin-bottom:14px}.card:hover{border-color:rgba(102,126,234,0.4);background:rgba(30,41,59,0.7);transform:translateY(-1px)}.card-content{pointer-events:none}.method{display:inline-block;padding:3px 8px;border-radius:4px;font-size:9px;font-weight:700;margin-bottom:8px;background:rgba(16,185,129,0.2);color:#10b981}.card-title{font-size:14px;font-weight:600;margin-bottom:6px}.card-desc{font-size:12px;color:rgba(255,255,255,0.5);line-height:1.4}.panel{background:rgba(15,23,42,0.8);border:1px solid rgba(102,126,234,0.2);border-radius:10px;padding:16px;margin-bottom:14px;max-height:0;overflow:hidden;transition:all 0.3s ease;margin-top:-14px}.panel.active{max-height:1000px;padding:16px;margin-top:0;margin-bottom:14px}.form-group{margin-bottom:12px}.label{display:block;font-size:11px;font-weight:600;color:#94a3b8;margin-bottom:5px;text-transform:uppercase}input,textarea{width:100%;padding:9px 12px;background:rgba(30,41,59,0.6);border:1px solid rgba(102,126,234,0.15);border-radius:6px;color:#e2e8f0;font-size:12px;font-family:inherit;transition:all 0.2s}input::placeholder,textarea::placeholder{color:rgba(148,163,184,0.4)}input:focus,textarea:focus{outline:0;background:rgba(30,41,59,0.8);border-color:rgba(102,126,234,0.4)}.category-btns{display:flex;flex-wrap:wrap;gap:8px;margin-bottom:10px}.category-btn{padding:8px 12px;background:rgba(102,126,234,0.1);border:1px solid rgba(102,126,234,0.15);border-radius:5px;color:#94a3b8;cursor:pointer;font-size:11px;transition:all 0.2s;font-weight:500;white-space:nowrap}.category-btn.active{background:rgba(102,126,234,0.3);border-color:rgba(102,126,234,0.4);color:#667eea}.btn{width:100%;padding:10px;background:linear-gradient(135deg,#667eea,#764ba2);border:0;border-radius:6px;color:#fff;font-weight:600;font-size:12px;cursor:pointer;transition:all 0.2s;margin-top:10px}.btn:hover{transform:translateY(-1px)}.result{margin-top:12px;padding:12px;background:rgba(0,0,0,0.2);border-radius:6px;border:1px solid rgba(102,126,234,0.1);max-height:600px;overflow-y:auto;font-size:11px;line-height:1.5;color:#cbd5e1}pre{white-space:pre-wrap;word-break:break-all;font-family:monospace;font-size:10px;background:rgba(0,0,0,0.3);padding:10px;border-radius:4px;overflow-x:auto}img.preview,video.preview{width:100%;border-radius:6px;margin-top:10px;max-height:300px;object-fit:contain}.loading{text-align:center;padding:15px;color:rgba(255,255,255,0.5);font-size:12px}.hidden{display:none}.error-msg{color:#ff6b6b;padding:10px;background:rgba(255,107,107,0.1);border-radius:4px;border:1px solid rgba(255,107,107,0.2);margin-bottom:10px}.success-msg{color:#51cf66;padding:10px;background:rgba(81,207,102,0.1);border-radius:4px;border:1px solid rgba(81,207,102,0.2);margin-bottom:10px}@media(max-width:640px){.grid{grid-template-columns:1fr}.result{max-height:400px}}`;

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

// ===== CLASSES =====

class TikTok {
  async download({ url }) {
    try {
      const { data } = await axios.get('https://www.tikwm.com/api/?url=' + encodeURIComponent(url), {headers: {'User-Agent': UA}, timeout: 10000});
      return data?.data || {};
    } catch(err) {
      throw new Error('TikTok: ' + err.message);
    }
  }
}
const tiktok = new TikTok();

class Anhmoe {
  #baseURL = "https://anh.moe";
  #headers = {"Origin": "https://anh.moe", "Referer": "https://anh.moe/", "User-Agent": "Zanixon/1.0.0"};
  #api;
  
  constructor() { 
    this.#api = axios.create({baseURL: this.#baseURL, timeout: 30000, headers: this.#headers}); 
  }
  
  async getCategory(category) {
    try {
      const raw = await this.#api(`/category/${category}`);
      const $ = cheerio.load(raw.data);
      const items = [];
      $(".list-item").each((_, el) => {
        try {
          const $el = $(el);
          let data = {};
          const rawData = $el.attr("data-object");
          if(rawData) data = JSON.parse(decodeURIComponent(rawData));
          
          const title = $el.find(".list-item-desc-title a").attr("title") || data.title || 'No title';
          const imgUrl = data.image?.url || $el.find('img').attr('src') || '';
          
          if (imgUrl) {
            items.push({
              type: data.type || 'image',
              title,
              image: { url: imgUrl },
              video: { url: imgUrl }
            });
          }
        } catch(e) {}
      });
      if (!items.length) throw new Error('No items found');
      return items;
    } catch(err) {
      throw new Error('Anh.moe: ' + err.message);
    }
  }
}
const anh = new Anhmoe();

async function scrapeXvideosSearch(query) {
  try {
    const resp = await axios.get('https://www.xvideos.com/?k=' + encodeURIComponent(query) + '&p=1', {
      headers: {'User-Agent': UA},
      timeout: 10000
    });
    const $ = cheerio.load(resp.data);
    const res = [];
    
    $('div[id^="video_"]').each((_, el) => {
      try {
        const $el = $(el);
        const link = $el.find('a[href*="/video"]').first();
        const url = link.attr('href');
        const title = link.attr('title') || 'Video';
        const cover = $el.find('img').attr('data-src') || $el.find('img').attr('src');
        
        if (url && url.includes('/video')) {
          res.push({
            title: title.substring(0, 80),
            url: url.startsWith('http') ? url : 'https://www.xvideos.com' + url,
            thumbnail: cover || null
          });
        }
      } catch(e) {}
    });
    
    return res.slice(0, 10);
  } catch(err) {
    throw new Error('XVideos: ' + err.message);
  }
}

async function scrapeXnxxSearch(query) {
  try {
    const resp = await axios.get('https://www.xnxx.com/search/' + encodeURIComponent(query) + '/1', {
      headers: {'User-Agent': UA},
      timeout: 10000
    });
    const $ = cheerio.load(resp.data);
    const results = [];
    
    $('div.thumbwrap').each((_, el) => {
      try {
        const $el = $(el);
        const link = $el.find('a').first();
        const url = link.attr('href');
        const title = link.attr('title') || 'Video';
        const cover = $el.find('img').attr('data-src') || $el.find('img').attr('src');
        
        if (url && url.includes('/video')) {
          results.push({
            title: title.substring(0, 80),
            url: url.startsWith('http') ? url : 'https://www.xnxx.com' + url,
            thumbnail: cover || null
          });
        }
      } catch(e) {}
    });
    
    return results.slice(0, 10);
  } catch(err) {
    throw new Error('XNXX: ' + err.message);
  }
}

async function getPornhubInfo(url) {
  return new Promise((resolve, reject) => {
    const payload = JSON.stringify({ platform: 'Pornhub', url, app_id: 'pornhub_downloader' });
    const options = {
      hostname: 'download.pornhubdownloader.io',
      path: '/xxx-download/video-info-v3',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': UA,
        'Content-Length': Buffer.byteLength(payload),
      },
      timeout: 15000
    };
    
    const req = https.request(options, res => {
      let body = '';
      res.setEncoding('utf8');
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try { resolve(JSON.parse(body)); } 
        catch(e) { reject(new Error('Invalid response')); }
      });
    });
    
    req.on('error', err => reject(err));
    req.on('timeout', () => reject(new Error('Timeout')));
    req.write(payload);
    req.end();
  });
}

class PornhubScraper {
  async search(query) {
    try {
      const url = 'https://www.pornhub.com/video/search?search=' + encodeURIComponent(query);
      const res = await axios.get(url, {
        headers: { 'User-Agent': UA, 'Referer': 'https://www.pornhub.com/' },
        timeout: 15000,
      });
      const $ = cheerio.load(res.data);
      const results = [];
      
      $('li.pcVideoListItem').each((_, el) => {
        try {
          const $el = $(el);
          const link = $el.find('a').first();
          const href = link.attr('href') || '';
          
          if (!href.includes('view_video')) return;
          
          const title = link.attr('title') || 'Video';
          const thumb = $el.find('img').attr('src');
          
          results.push({
            title: title.substring(0, 80),
            url: href.startsWith('http') ? href : 'https://www.pornhub.com' + href,
            thumbnail: thumb || null
          });
        } catch(e) {}
      });
      
      return results.slice(0, 10);
    } catch(err) {
      throw new Error('Pornhub: ' + err.message);
    }
  }
}
const pornhubScraper = new PornhubScraper();

// ===== ROUTES =====

app.get("/api/d/tiktok", async (req, res) => {
  try {
    if (!req.query.url) return res.status(400).json({status: false, error: "URL required"});
    const result = await tiktok.download({url: req.query.url});
    res.json({status: true, result});
  } catch(err) {
    res.status(500).json({status: false, error: err.message});
  }
});

app.get("/random/ba", async (req, res) => {
  try {
    const { data } = await axios.get("https://raw.githubusercontent.com/rynxzyy/blue-archive-r-img/refs/heads/main/links.json", {timeout: 10000});
    const imgUrl = data[Math.floor(Math.random() * data.length)];
    const imgRes = await axios.get(imgUrl, {responseType: "arraybuffer", timeout: 10000});
    res.writeHead(200, {"Content-Type": "image/jpeg"});
    res.end(Buffer.from(imgRes.data));
  } catch(err) {
    res.status(500).json({error: err.message});
  }
});

app.get("/random/china", async (req, res) => {
  try {
    const { data } = await axios.get("https://github.com/ArifzynXD/database/raw/master/asupan/china.json", {timeout: 10000});
    const rand = data[Math.floor(Math.random() * data.length)];
    const imgRes = await axios.get(rand.url, {responseType: "arraybuffer", timeout: 10000});
    res.writeHead(200, {"Content-Type": "image/jpeg"});
    res.end(Buffer.from(imgRes.data));
  } catch(err) {
    res.status(500).json({error: err.message});
  }
});

app.post('/n18', async (req, res) => {
  try {
    const { action, source, query } = req.body;
    if (!action || !source || !query) return res.status(400).json({ error: "Missing params" });
    
    let results = [];
    if (source === "xv") results = await scrapeXvideosSearch(query);
    else if (source === "xn") results = await scrapeXnxxSearch(query);
    
    res.json({ results });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/pornhub/search', async (req, res) => {
  try {
    const { query } = req.body;
    if (!query) return res.status(400).json({ error: "Query required" });
    const results = await pornhubScraper.search(query);
    res.json({ results });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/pornhub/info', async (req, res) => {
  try {
    const { url } = req.body;
    if (!url) return res.status(400).json({ error: "URL required" });
    const data = await getPornhubInfo(url);
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/anhmoe/random', async (req, res) => {
  try {
    const { category } = req.body;
    if (!category) return res.status(400).json({ error: "Category required" });
    const items = await anh.getCategory(category);
    const item = items[Math.floor(Math.random() * items.length)];
    res.json({ item });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get("/health", (req, res) => {
  res.json({status: "ok", env: ENV, platform: IS_VERCEL ? "vercel" : "termux"});
});

// ===== FRONTEND =====

app.get("/", (req, res) => {
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1.0">
<title>API Panel</title>
<style>${css}</style>
</head>
<body>
<div class="container">
<header><h1>🚀 API Panel <span class="badge">${IS_VERCEL ? 'VERCEL' : 'TERMUX'}</span></h1></header>
<div id="content"></div>
</div>
<script>
const endpoints=[
{id:'tiktok',title:'TikTok Download'},
{id:'ba',title:'Blue Archive'},
{id:'china',title:'Random China'},
{id:'anhmoe',title:'Anh.moe Random'},
{id:'xv',title:'XVideos Search'},
{id:'xn',title:'XNXX Search'},
{id:'ph_search',title:'Pornhub Search'},
{id:'ph_info',title:'Pornhub Info'},
];

let expandedId=null, selectedCategory='sfw';

function render(){
  const c=document.getElementById('content');
  c.innerHTML=endpoints.map(e=>'<div><div class="card" onclick="toggle(\\''+e.id+'\\')"><div class="card-content"><span class="method">GET</span><div class="card-title">'+e.title+'</div></div></div><div class="panel" id="p-'+e.id+'"></div></div>').join('');
}

function toggle(id){
  if(expandedId&&expandedId!==id){const o=document.getElementById('p-'+expandedId);if(o)o.classList.remove('active');}
  const p=document.getElementById('p-'+id);
  p.classList.toggle('active');
  expandedId=p.classList.contains('active')?id:null;
  if(expandedId)buildPanel(id,p);
}

function buildPanel(id,el){
  let h='';
  if(id==='tiktok') h='<div class="form-group"><label class="label">TikTok URL</label><input id="tt" placeholder="https://vt.tiktok.com/..."/></div><button class="btn" onclick="call(\\'tiktok\\')">Download</button>';
  else if(id==='ba'||id==='china') h='<button class="btn" onclick="call(\\''+id+'\\')">Load</button>';
  else if(id==='anhmoe'){
    h='<div class="form-group"><label class="label">Category</label><div class="category-btns">';
    ['sfw','nsfw','video-gore','video-nsfw','moe','ai-picture','hentai'].forEach(cat=>h+='<button class="category-btn '+(cat==='sfw'?'active':'')+'" onclick="setCat(\\''+cat+'\\')">'+cat+'</button>');
    h+='</div></div><button class="btn" onclick="call(\\'anhmoe\\')">Load</button>';
  }else if(id==='ph_search') h='<div class="form-group"><label class="label">Search</label><input id="phs" placeholder="Search..."/></div><button class="btn" onclick="call(\\'ph_search\\')">Search</button>';
  else if(id==='ph_info') h='<div class="form-group"><label class="label">Pornhub URL</label><input id="phi" placeholder="https://pornhub.com/..."/></div><button class="btn" onclick="call(\\'ph_info\\')">Info</button>';
  else if(id==='xv'||id==='xn') h='<div class="form-group"><label class="label">Search</label><input id="s'+id+'" placeholder="Search..."/></div><button class="btn" onclick="call(\\''+id+'\\')">Search</button>';
  h+='<div id="r-'+id+'" class="result hidden"></div>';
  el.innerHTML=h;
}

function setCat(cat){selectedCategory=cat;document.querySelectorAll('.category-btn').forEach(b=>b.classList.remove('active'));event.target.classList.add('active');}

async function call(id){
  const r=document.getElementById('r-'+id);
  r.classList.remove('hidden');
  r.innerHTML='<div class="loading">Loading...</div>';
  try{
    if(id==='tiktok'){
      const u=document.getElementById('tt').value.trim();
      if(!u)throw new Error('URL required');
      const res=await fetch('/api/d/tiktok?url='+encodeURIComponent(u));
      const d=await res.json();
      r.innerHTML='<div class="success-msg">Success!</div><pre>'+JSON.stringify(d,null,2)+'</pre>';
    }else if(id==='ba'){
      const res=await fetch('/random/ba');
      const b=await res.blob();
      r.innerHTML='<img class="preview" src="'+URL.createObjectURL(b)+'"/>';
    }else if(id==='china'){
      const res=await fetch('/random/china');
      const b=await res.blob();
      r.innerHTML='<img class="preview" src="'+URL.createObjectURL(b)+'"/>';
    }else if(id==='anhmoe'){
      const res=await fetch('/api/anhmoe/random',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({category:selectedCategory})});
      const d=await res.json();
      if(!res.ok)throw new Error(d.error);
      const i=d.item;
      r.innerHTML=i.image.url?'<img class="preview" src="'+i.image.url+'"/>':'<div class="error-msg">No media</div>';
    }else if(id==='ph_search'){
      const q=document.getElementById('phs').value.trim();
      if(!q)throw new Error('Query required');
      const res=await fetch('/api/pornhub/search',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({query:q})});
      const d=await res.json();
      if(!res.ok)throw new Error(d.error);
      let h='<div class="success-msg">Found '+d.results.length+' results</div>';
      d.results.forEach((it,i)=>h+='<div style="margin:8px 0;padding:8px;background:rgba(102,126,234,0.1);border-radius:4px"><strong>'+i+'.</strong> '+it.title+'</div>');
      h+='<pre style="margin-top:15px">'+JSON.stringify(d,null,2)+'</pre>';
      r.innerHTML=h;
    }else if(id==='ph_info'){
      const u=document.getElementById('phi').value.trim();
      if(!u)throw new Error('URL required');
      const res=await fetch('/api/pornhub/info',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({url:u})});
      const d=await res.json();
      r.innerHTML='<pre>'+JSON.stringify(d,null,2)+'</pre>';
    }else if(id==='xv'||id==='xn'){
      const q=document.getElementById('s'+id).value.trim();
      if(!q)throw new Error('Query required');
      const res=await fetch('/n18',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'search',source:id,query:q})});
      const d=await res.json();
      if(!res.ok)throw new Error(d.error);
      let h='<div class="success-msg">Found '+d.results.length+' results</div>';
      d.results.forEach((it,i)=>h+='<div style="margin:8px 0;padding:8px;background:rgba(102,126,234,0.1);border-radius:4px"><strong>'+i+'.</strong> '+it.title+'</div>');
      h+='<pre style="margin-top:15px">'+JSON.stringify(d,null,2)+'</pre>';
      r.innerHTML=h;
    }
  }catch(err){r.innerHTML='<div class="error-msg">Error: '+err.message+'</div>';}
}

render();
</script>
</body>
</html>`;
  res.send(html);
});

export default app;

if (!IS_VERCEL) {
  app.listen(PORT, "0.0.0.0", () => log.success("Server running at http://localhost:" + PORT));
}