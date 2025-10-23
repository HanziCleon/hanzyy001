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

const css = `*{margin:0;padding:0;box-sizing:border-box}body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#0f172a;color:#e2e8f0;min-height:100vh;padding:20px}.container{max-width:1100px;margin:0 auto}header{text-align:center;padding:25px 0;margin-bottom:25px}h1{font-size:clamp(24px,5vw,34px);font-weight:700;background:linear-gradient(135deg,#667eea,#764ba2);-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text}.badge{display:inline-block;padding:5px 12px;background:rgba(102,126,234,0.15);border:1px solid rgba(102,126,234,0.3);border-radius:15px;font-size:11px;margin-left:8px;font-weight:600;color:#667eea}.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(240px,1fr));gap:14px}.card{background:rgba(30,41,59,0.5);border:1px solid rgba(102,126,234,0.15);border-radius:10px;padding:16px;cursor:pointer;transition:all 0.2s;margin-bottom:14px}.card:hover{border-color:rgba(102,126,234,0.4);background:rgba(30,41,59,0.7);transform:translateY(-1px)}.card-content{pointer-events:none}.method{display:inline-block;padding:3px 8px;border-radius:4px;font-size:9px;font-weight:700;margin-bottom:8px;background:rgba(16,185,129,0.2);color:#10b981}.card-title{font-size:14px;font-weight:600;margin-bottom:6px}.card-desc{font-size:12px;color:rgba(255,255,255,0.5);line-height:1.4}.panel{background:rgba(15,23,42,0.8);border:1px solid rgba(102,126,234,0.2);border-radius:10px;padding:16px;margin-bottom:14px;max-height:0;overflow:hidden;transition:all 0.3s ease;margin-top:-14px}.panel.active{max-height:800px;padding:16px;margin-top:0;margin-bottom:14px}.form-group{margin-bottom:12px}.label{display:block;font-size:11px;font-weight:600;color:#94a3b8;margin-bottom:5px;text-transform:uppercase}input,textarea{width:100%;padding:9px 12px;background:rgba(30,41,59,0.6);border:1px solid rgba(102,126,234,0.15);border-radius:6px;color:#e2e8f0;font-size:12px;font-family:inherit;transition:all 0.2s}input::placeholder,textarea::placeholder{color:rgba(148,163,184,0.4)}input:focus,textarea:focus{outline:0;background:rgba(30,41,59,0.8);border-color:rgba(102,126,234,0.4)}.format-group{display:flex;gap:8px;margin-bottom:10px}.format-btn{flex:1;padding:8px;background:rgba(102,126,234,0.1);border:1px solid rgba(102,126,234,0.15);border-radius:5px;color:#94a3b8;cursor:pointer;font-size:11px;transition:all 0.2s;font-weight:500}.format-btn.active{background:rgba(102,126,234,0.3);border-color:rgba(102,126,234,0.4);color:#667eea}.category-btns{display:flex;flex-wrap:wrap;gap:8px;margin-bottom:10px}.category-btn{padding:8px 12px;background:rgba(102,126,234,0.1);border:1px solid rgba(102,126,234,0.15);border-radius:5px;color:#94a3b8;cursor:pointer;font-size:11px;transition:all 0.2s;font-weight:500;white-space:nowrap}.category-btn.active{background:rgba(102,126,234,0.3);border-color:rgba(102,126,234,0.4);color:#667eea}.btn{width:100%;padding:10px;background:linear-gradient(135deg,#667eea,#764ba2);border:0;border-radius:6px;color:#fff;font-weight:600;font-size:12px;cursor:pointer;transition:all 0.2s;margin-top:10px}.btn:hover{transform:translateY(-1px)}.result{margin-top:12px;padding:12px;background:rgba(0,0,0,0.2);border-radius:6px;border:1px solid rgba(102,126,234,0.1);max-height:400px;overflow-y:auto;font-size:11px;line-height:1.5;color:#cbd5e1}pre{white-space:pre-wrap;word-break:break-all;font-family:monospace;font-size:10px}img.preview,video.preview{width:100%;border-radius:6px;margin-top:10px;max-height:250px}.loading{text-align:center;padding:15px;color:rgba(255,255,255,0.5);font-size:12px}.hidden{display:none}@media(max-width:640px){.grid{grid-template-columns:1fr}}`;

// ===== CLASSES & UTILITIES =====

class TikTok {
  async download({ url }) {
    const { data } = await axios.get('https://www.tikwm.com/api/?url=' + encodeURIComponent(url));
    return data?.data || {};
  }
}
const tiktok = new TikTok();

class Anhmoe {
  #baseURL = "https://anh.moe";
  #headers = {"Origin": "https://anh.moe", "Referer": "https://anh.moe/", "User-Agent": "Zanixon/1.0.0"};
  #api;
  #validCategories = ["sfw","nsfw","video-gore","video-nsfw","moe","ai-picture","hentai"];
  
  constructor() { 
    this.#api = axios.create({baseURL: this.#baseURL, timeout: 120000, headers: this.#headers}); 
  }
  
  getCategories() { 
    return this.#validCategories; 
  }
  
  async getCategory(category) {
    const raw = await this.#api(`/category/${category}`);
    const $ = cheerio.load(raw.data);
    const items = [];
    $(".list-item").each((_, el) => {
      const $el = $(el);
      let data = {};
      const rawData = $el.attr("data-object");
      if(rawData) { try { data = JSON.parse(decodeURIComponent(rawData)); } catch {} }
      const title = $el.find(".list-item-desc-title a").attr("title") || data.title;
      const viewLink = new URL($el.find(".list-item-image a").attr("href"), this.#baseURL).href;
      items.push({
        type: data.type,
        title,
        viewLink,
        [data.type]: {...data.image, sizeFormatted: data.size_formatted, width: data.width, height: data.height}
      });
    });
    return items;
  }
}
const anh = new Anhmoe();

async function scrapeXvideosSearch(query, page = 1) {
  const resp = await axios.get('https://www.xvideos.com/?k=' + encodeURIComponent(query) + '&p=' + page, {headers: {'User-Agent': 'Mozilla/5.0'}});
  const $ = cheerio.load(resp.data);
  const res = [];
  $('div[id*="video"]').each((_, bkp) => {
    const title = $(bkp).find('.thumb-under p.title a').text().trim();
    const duration = $(bkp).find('.thumb-under p.metadata span.duration').text().trim();
    const cover = $(bkp).find('.thumb-inside .thumb img').attr('data-src') || $(bkp).find('.thumb-inside .thumb img').attr('src');
    const url = $(bkp).find('.thumb-inside .thumb a').attr('href');
    if (url) {
      res.push({
        title, duration, cover,
        url: 'https://www.xvideos.com' + url
      });
    }
  });
  return res;
}

async function scrapeXnxxSearch(query, page = 1) {
  const resp = await axios.get('https://www.xnxx.com/search/' + encodeURIComponent(query) + '/' + page);
  const $ = cheerio.load(resp.data);
  const results = [];
  $('div.mozaique div.thumb').each((_, bkp) => {
    const title = $(bkp).find('a').attr('title');
    const cover = $(bkp).find('img').attr('data-src') || $(bkp).find('img').attr('src');
    const url = $(bkp).find('a').attr('href');
    if (url && title) {
      results.push({
        title, cover,
        url: 'https://www.xnxx.com' + url
      });
    }
  });
  return results;
}

async function getPornhubInfo(url) {
  const payload = JSON.stringify({ platform: 'Pornhub', url: url, app_id: 'pornhub_downloader' });
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'download.pornhubdownloader.io',
      path: '/xxx-download/video-info-v3',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
        'Content-Length': Buffer.byteLength(payload),
      },
      timeout: 20000
    };
    const req = https.request(options, res => {
      let body = '';
      res.setEncoding('utf8');
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try { resolve(JSON.parse(body)); } catch(e) { reject(e); }
      });
    });
    req.on('error', err => reject(err));
    req.write(payload);
    req.end();
  });
}

class PornhubScraper {
  constructor(opts = {}) {
    this.baseURL = 'https://www.pornhub.com';
    this.userAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36';
    this.delayMs = typeof opts.delayMs === 'number' ? opts.delayMs : 300;
  }
  
  async fetchHTML(url) {
    try {
      const res = await axios.get(url, {
        headers: { 'User-Agent': this.userAgent, Referer: this.baseURL + '/' },
        timeout: 20000,
      });
      return res.data;
    } catch (err) {
      throw new Error('HTTP error: ' + err.message);
    }
  }
  
  async search(query, page = 1) {
    const url = `${this.baseURL}/video/search?search=${encodeURIComponent(query)}&page=${page}`;
    const html = await this.fetchHTML(url);
    const $ = cheerio.load(html);
    const results = [];
    
    $('li.pcVideoListItem.videoBox, ul#videoSearchResult li').each((_, el) => {
      const element = $(el);
      const a = element.find('a').first();
      const href = (a.attr('href') || '').trim();
      if (!href || !href.includes('/view_video.php?viewkey=')) return;
      
      const title = (a.attr('title') || element.find('.title').text() || '').trim();
      const fullUrl = href.startsWith('http') ? href : this.baseURL + href;
      const thumb = (element.find('img').attr('data-thumb_url') || element.find('img').attr('src') || '').trim();
      results.push({ title: title || null, url: fullUrl, thumbnail: thumb || null });
    });
    
    const out = [];
    const seen = new Set();
    for (const r of results) {
      if (!r.url || seen.has(r.url)) continue;
      seen.add(r.url);
      out.push(r);
    }
    return out;
  }
}
const pornhubScraper = new PornhubScraper();

// ===== API ROUTES =====

app.get("/api/d/tiktok", async (req, res) => {
  try {
    const result = await tiktok.download({url: req.query.url});
    res.json({status: true, result});
  } catch(err) {
    res.status(500).json({status: false, error: err.message});
  }
});

app.get("/random/ba", async (req, res) => {
  try {
    const { data } = await axios.get("https://raw.githubusercontent.com/rynxzyy/blue-archive-r-img/refs/heads/main/links.json");
    const imgUrl = data[Math.floor(Math.random() * data.length)];
    const imgRes = await axios.get(imgUrl, {responseType: "arraybuffer"});
    res.writeHead(200, {"Content-Type": "image/jpeg"});
    res.end(Buffer.from(imgRes.data));
  } catch(err) {
    res.status(500).json({error: err.message});
  }
});

app.get("/random/china", async (req, res) => {
  try {
    const { data } = await axios.get("https://github.com/ArifzynXD/database/raw/master/asupan/china.json");
    const rand = data[Math.floor(Math.random() * data.length)];
    const imgRes = await axios.get(rand.url, {responseType: "arraybuffer"});
    res.writeHead(200, {"Content-Type": "image/jpeg"});
    res.end(Buffer.from(imgRes.data));
  } catch(err) {
    res.status(500).json({error: err.message});
  }
});

app.post('/n18', async (req, res) => {
  try {
    const { action, source, query } = req.body;
    if (action === "search") {
      if (!source || !query) return res.status(400).json({ error: "Missing source or query" });
      const list = source === "xv" ? await scrapeXvideosSearch(query) : await scrapeXnxxSearch(query);
      if (!list.length) return res.json({ message: "No videos found" });
      return res.json({ results: list.slice(0, 5) });
    }
    return res.status(400).json({ error: "Invalid action" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

app.post('/api/pornhub/search', async (req, res) => {
  try {
    const { query } = req.body;
    if (!query) return res.status(400).json({ error: "Query required" });
    const results = await pornhubScraper.search(query);
    res.json({ results: results.slice(0, 5) });
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
    if (!items.length) return res.status(404).json({ error: "No items found" });
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

const htmlContent = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1.0">
<title>API Panel</title>
<style>${css}</style>
</head>
<body>
<div class="container">
<header>
<h1>Rocket API Panel <span class="badge">${IS_VERCEL ? 'VERCEL' : 'TERMUX'}</span></h1>
</header>
<div id="content"></div>
</div>
<script>
const endpoints=[
{id:'tiktok',type:'single',title:'TikTok Download',desc:'DL TikTok tanpa watermark'},
{id:'ba',type:'single',title:'Blue Archive',desc:'Random Blue Archive'},
{id:'china',type:'single',title:'Random China',desc:'Random China image'},
{id:'anhmoe',type:'category',title:'Anh.moe Random',desc:'Random Anh.moe by category'},
{id:'xv',type:'search',title:'XVideos Search',desc:'Search XVideos'},
{id:'xn',type:'search',title:'XNXX Search',desc:'Search XNXX'},
{id:'ph_search',type:'search',title:'Pornhub Search',desc:'Search Pornhub'},
{id:'ph_info',type:'single',title:'Pornhub Info',desc:'Get Pornhub video info'},
];

let expandedId=null;
let selectedCategory='sfw';

function renderEndpoints(){
const content=document.getElementById('content');
content.innerHTML=endpoints.map(ep=>'<div id="ep-'+ep.id+'"><div class="card" onclick="togglePanel('+String.fromCharCode(39)+ep.id+String.fromCharCode(39)+')"><div class="card-content"><span class="method">GET</span><div class="card-title">'+ep.title+'</div><div class="card-desc">'+ep.desc+'</div></div></div><div class="panel" id="panel-'+ep.id+'"></div></div>').join('');
}

function togglePanel(id){
if(expandedId&&expandedId!==id){const old=document.getElementById('panel-'+expandedId);if(old)old.classList.remove('active');}
const panel=document.getElementById('panel-'+id);
panel.classList.toggle('active');
expandedId=panel.classList.contains('active')?id:null;
if(panel.classList.contains('active'))renderPanel(id,panel);
}

function renderPanel(id,panelEl){
const ep=endpoints.find(e=>e.id===id);
let html='';
if(id==='tiktok'){
html='<div class="form-group"><label class="label">TikTok URL</label><input id="tt-url" placeholder="https://vt.tiktok.com/..."/></div><button class="btn" onclick="callAPI('+String.fromCharCode(39)+'tiktok'+String.fromCharCode(39)+')">Download</button>';
}else if(id==='ba'||id==='china'){
html='<button class="btn" onclick="callAPI('+String.fromCharCode(39)+id+String.fromCharCode(39)+')">Load Random</button>';
}else if(id==='anhmoe'){
const categories=['sfw','nsfw','video-gore','video-nsfw','moe','ai-picture','hentai'];
html='<div class="form-group"><label class="label">Category</label><div class="category-btns">';
categories.forEach(cat=>{
html+='<button class="category-btn '+(cat==='sfw'?'active':'')+'" onclick="setCategory('+String.fromCharCode(39)+cat+String.fromCharCode(39)+')">'+cat.toUpperCase()+'</button>';
});
html+='</div></div><button class="btn" onclick="callAPI('+String.fromCharCode(39)+'anhmoe'+String.fromCharCode(39)+')">Load Random</button>';
}else if(id==='ph_search'){
html='<div class="form-group"><label class="label">Search Query</label><input id="search-ph_search" placeholder="Search..."/></div><button class="btn" onclick="callAPI('+String.fromCharCode(39)+'ph_search'+String.fromCharCode(39)+')">Search</button>';
}else if(id==='ph_info'){
html='<div class="form-group"><label class="label">Pornhub URL</label><input id="ph-url" placeholder="https://pornhub.com/view_video.php?..."/></div><button class="btn" onclick="callAPI('+String.fromCharCode(39)+'ph_info'+String.fromCharCode(39)+')">Get Info</button>';
}else if(id==='xv'||id==='xn'){
html='<div class="form-group"><label class="label">Search Query</label><input id="search-'+id+'" placeholder="Search..."/></div><button class="btn" onclick="callAPI('+String.fromCharCode(39)+id+String.fromCharCode(39)+')">Search</button>';
}
html+='<div id="result-'+id+'" class="result hidden"></div>';
panelEl.innerHTML=html;
}

function setCategory(cat){
selectedCategory=cat;
document.querySelectorAll('#panel-anhmoe .category-btn').forEach(b=>b.classList.remove('active'));
event.target.classList.add('active');
}

async function callAPI(id){
const resultEl=document.getElementById('result-'+id);
resultEl.classList.remove('hidden');
resultEl.innerHTML='<div class="loading">Loading...</div>';
try{
if(id==='tiktok'){
const url=document.getElementById('tt-url').value.trim();
if(!url)throw new Error('URL required');
const res=await fetch('/api/d/tiktok?url='+encodeURIComponent(url));
const data=await res.json();
resultEl.innerHTML='<pre>'+JSON.stringify(data,null,2)+'</pre>';
}else if(id==='ba'){
const res=await fetch('/random/ba');
const blob=await res.blob();
resultEl.innerHTML='<img class="preview" src="'+URL.createObjectURL(blob)+'"/>';
}else if(id==='china'){
const res=await fetch('/random/china');
const blob=await res.blob();
resultEl.innerHTML='<img class="preview" src="'+URL.createObjectURL(blob)+'"/>';
}else if(id==='anhmoe'){
const res=await fetch('/api/anhmoe/random',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({category:selectedCategory})});
const data=await res.json();
if(data.error){resultEl.innerHTML='<pre>Error: '+data.error+'</pre>';return;}
const item=data.item;
if(item.type==='video'){resultEl.innerHTML='<video class="preview" controls src="'+item.video.url+'"></video>';}else{resultEl.innerHTML='<img class="preview" src="'+item.image.url+'"/>';}
}else if(id==='ph_search'){
const q=document.getElementById('search-ph_search').value.trim();
if(!q)throw new Error('Query required');
const res=await fetch('/api/pornhub/search',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({query:q})});
const data=await res.json();
if(data.error){resultEl.innerHTML='<pre>Error: '+data.error+'</pre>';return;}
let html='<div style="display:grid;gap:12px">';
data.results.forEach(item=>{
const thumb=item.thumbnail?'<img src="'+item.thumbnail+'" style="width:100%;border-radius:6px;margin-bottom:8px"/>':"";
html+='<div style="border:1px solid rgba(102,126,234,0.2);padding:10px;border-radius:6px">'+thumb+'<strong>'+item.title+'</strong><br><a href="'+item.url+'" target="_blank" style="color:#667eea">Watch</a></div>';
});
html+='</div>';
resultEl.innerHTML=html;
}else if(id==='ph_info'){
const url=document.getElementById('ph-url').value.trim();
if(!url)throw new Error('URL required');
const res=await fetch('/api/pornhub/info',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({url:url})});
const data=await res.json();
resultEl.innerHTML='<pre>'+JSON.stringify(data,null,2)+'</pre>';
}else if(id==='xv'||id==='xn'){
const q=document.getElementById('search-'+id).value.trim();
if(!q)throw new Error('Query required');
const res=await fetch('/n18',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'search',source:id,query:q})});
const data=await res.json();
if(data.error){resultEl.innerHTML='<pre>Error: '+data.error+'</pre>';return;}
if(data.message){resultEl.innerHTML='<pre>'+data.message+'</pre>';return;}
let html='<div style="display:grid;gap:12px">';
data.results.forEach(item=>{
const thumb=item.cover?'<img src="'+item.cover+'" style="width:100%;border-radius:6px;margin-bottom:8px"/>':"";
html+='<div style="border:1px solid rgba(102,126,234,0.2);padding:10px;border-radius:6px">'+thumb+'<strong>'+item.title+'</strong><br><a href="'+item.url+'" target="_blank" style="color:#667eea">Watch</a></div>';
});
html+='</div>';
resultEl.innerHTML=html;
}
}catch(err){
resultEl.innerHTML='<pre>Error: '+err.message+'</pre>';
}
}

renderEndpoints();
</script>
</body>
</html>`;

app.get("/", (req, res) => {
  res.send(htmlContent);
});

export default app;

if (!IS_VERCEL) {
  app.listen(PORT, "0.0.0.0", () => log.success("Server running at http://localhost:" + PORT));
}
