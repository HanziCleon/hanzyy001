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

const css = `*{margin:0;padding:0;box-sizing:border-box}body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#0f172a;color:#e2e8f0;min-height:100vh;padding:20px}.container{max-width:1100px;margin:0 auto}header{text-align:center;padding:25px 0;margin-bottom:25px}h1{font-size:clamp(24px,5vw,34px);font-weight:700;background:linear-gradient(135deg,#667eea,#764ba2);-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text}.badge{display:inline-block;padding:5px 12px;background:rgba(102,126,234,0.15);border:1px solid rgba(102,126,234,0.3);border-radius:15px;font-size:11px;margin-left:8px;font-weight:600;color:#667eea}.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(240px,1fr));gap:14px}.card{background:rgba(30,41,59,0.5);border:1px solid rgba(102,126,234,0.15);border-radius:10px;padding:16px;cursor:pointer;transition:all 0.2s;margin-bottom:14px}.card:hover{border-color:rgba(102,126,234,0.4);background:rgba(30,41,59,0.7);transform:translateY(-1px)}.card-content{pointer-events:none}.method{display:inline-block;padding:3px 8px;border-radius:4px;font-size:9px;font-weight:700;margin-bottom:8px;background:rgba(16,185,129,0.2);color:#10b981}.card-title{font-size:14px;font-weight:600;margin-bottom:6px}.card-desc{font-size:12px;color:rgba(255,255,255,0.5);line-height:1.4}.panel{background:rgba(15,23,42,0.8);border:1px solid rgba(102,126,234,0.2);border-radius:10px;padding:16px;margin-bottom:14px;max-height:0;overflow:hidden;transition:all 0.3s ease;margin-top:-14px}.panel.active{max-height:1000px;padding:16px;margin-top:0;margin-bottom:14px}.form-group{margin-bottom:12px}.label{display:block;font-size:11px;font-weight:600;color:#94a3b8;margin-bottom:5px;text-transform:uppercase}input,textarea{width:100%;padding:9px 12px;background:rgba(30,41,59,0.6);border:1px solid rgba(102,126,234,0.15);border-radius:6px;color:#e2e8f0;font-size:12px;font-family:inherit;transition:all 0.2s}input::placeholder,textarea::placeholder{color:rgba(148,163,184,0.4)}input:focus,textarea:focus{outline:0;background:rgba(30,41,59,0.8);border-color:rgba(102,126,234,0.4)}.category-btns{display:flex;flex-wrap:wrap;gap:8px;margin-bottom:10px}.category-btn{padding:8px 12px;background:rgba(102,126,234,0.1);border:1px solid rgba(102,126,234,0.15);border-radius:5px;color:#94a3b8;cursor:pointer;font-size:11px;transition:all 0.2s;font-weight:500;white-space:nowrap}.category-btn.active{background:rgba(102,126,234,0.3);border-color:rgba(102,126,234,0.4);color:#667eea}.btn{width:100%;padding:10px;background:linear-gradient(135deg,#667eea,#764ba2);border:0;border-radius:6px;color:#fff;font-weight:600;font-size:12px;cursor:pointer;transition:all 0.2s;margin-top:10px}.btn:hover{transform:translateY(-1px)}.result{margin-top:12px;padding:12px;background:rgba(0,0,0,0.2);border-radius:6px;border:1px solid rgba(102,126,234,0.1);max-height:500px;overflow-y:auto;font-size:11px;line-height:1.5;color:#cbd5e1}.result-item{border:1px solid rgba(102,126,234,0.2);padding:10px;border-radius:6px;margin-bottom:10px;background:rgba(30,41,59,0.3)}.result-item img{width:100%;border-radius:4px;margin-bottom:8px;max-height:150px;object-fit:cover}.result-item a{color:#667eea;text-decoration:none;font-weight:600}.result-item a:hover{text-decoration:underline}pre{white-space:pre-wrap;word-break:break-all;font-family:monospace;font-size:10px;background:rgba(0,0,0,0.3);padding:10px;border-radius:4px}img.preview,video.preview{width:100%;border-radius:6px;margin-top:10px;max-height:250px}.loading{text-align:center;padding:15px;color:rgba(255,255,255,0.5);font-size:12px}.hidden{display:none}.error-msg{color:#ff6b6b;padding:10px;background:rgba(255,107,107,0.1);border-radius:4px;border:1px solid rgba(255,107,107,0.2)}.success-msg{color:#51cf66;padding:10px;background:rgba(81,207,102,0.1);border-radius:4px;border:1px solid rgba(81,207,102,0.2)}@media(max-width:640px){.grid{grid-template-columns:1fr}}`;

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

// ===== CLASSES & UTILITIES =====

class TikTok {
  async download({ url }) {
    try {
      const { data } = await axios.get('https://www.tikwm.com/api/?url=' + encodeURIComponent(url), {headers: {'User-Agent': UA}});
      return data?.data || {};
    } catch(err) {
      throw new Error('TikTok API error: ' + err.message);
    }
  }
}
const tiktok = new TikTok();

class Anhmoe {
  #baseURL = "https://anh.moe";
  #headers = {"Origin": "https://anh.moe", "Referer": "https://anh.moe/", "User-Agent": "Zanixon/1.0.0"};
  #api;
  #validCategories = ["sfw","nsfw","video-gore","video-nsfw","moe","ai-picture","hentai"];
  
  constructor() { 
    this.#api = axios.create({baseURL: this.#baseURL, timeout: 30000, headers: this.#headers}); 
  }
  
  getCategories() { 
    return this.#validCategories; 
  }
  
  async getCategory(category) {
    try {
      const raw = await this.#api(`/category/${category}`);
      const $ = cheerio.load(raw.data);
      const items = [];
      $(".list-item").each((_, el) => {
        const $el = $(el);
        let data = {};
        const rawData = $el.attr("data-object");
        if(rawData) { try { data = JSON.parse(decodeURIComponent(rawData)); } catch {} }
        const title = $el.find(".list-item-desc-title a").attr("title") || data.title;
        const imgUrl = data.image?.url || $el.find('img').attr('src');
        if (imgUrl || title) {
          items.push({
            type: data.type || 'image',
            title: title || 'No title',
            image: { url: imgUrl },
            video: { url: imgUrl }
          });
        }
      });
      if (!items.length) throw new Error('No items found in category');
      return items;
    } catch(err) {
      throw new Error('Anh.moe error: ' + err.message);
    }
  }
}
const anh = new Anhmoe();

async function scrapeXvideosSearch(query, page = 1) {
  try {
    const resp = await axios.get('https://www.xvideos.com/?k=' + encodeURIComponent(query) + '&p=' + page, {
      headers: {'User-Agent': UA},
      timeout: 10000
    });
    const $ = cheerio.load(resp.data);
    const res = [];
    
    $('div[id*="video_"]').each((_, el) => {
      try {
        const $el = $(el);
        const link = $el.find('a[href*="/video"]').first();
        const title = link.attr('title') || link.text()?.trim() || 'No title';
        const url = link.attr('href');
        const cover = $el.find('img').attr('data-src') || $el.find('img').attr('src');
        
        if (url && url.includes('/video')) {
          res.push({
            title,
            cover: cover || null,
            url: url.startsWith('http') ? url : 'https://www.xvideos.com' + url
          });
        }
      } catch(e) {}
    });
    
    return res.length ? res.slice(0, 10) : [];
  } catch(err) {
    log.error('XVideos scrape error: ' + err.message);
    throw new Error('XVideos search failed: ' + err.message);
  }
}

async function scrapeXnxxSearch(query, page = 1) {
  try {
    const resp = await axios.get('https://www.xnxx.com/search/' + encodeURIComponent(query) + '/' + page, {
      headers: {'User-Agent': UA},
      timeout: 10000
    });
    const $ = cheerio.load(resp.data);
    const results = [];
    
    $('div.mozaique li, div.mozaique div').each((_, el) => {
      try {
        const $el = $(el);
        const link = $el.find('a[href*="/video"]').first();
        const title = link.attr('title') || link.text()?.trim() || 'No title';
        const url = link.attr('href');
        const cover = $el.find('img').attr('data-src') || $el.find('img').attr('src');
        
        if (url && url.includes('/video')) {
          results.push({
            title,
            cover: cover || null,
            url: url.startsWith('http') ? url : 'https://www.xnxx.com' + url
          });
        }
      } catch(e) {}
    });
    
    return results.length ? results.slice(0, 10) : [];
  } catch(err) {
    log.error('XNXX scrape error: ' + err.message);
    throw new Error('XNXX search failed: ' + err.message);
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
        try { 
          const parsed = JSON.parse(body);
          resolve(parsed); 
        } catch(e) { 
          reject(new Error('Invalid JSON response')); 
        }
      });
    });
    
    req.on('error', err => reject(err));
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Request timeout'));
    });
    req.write(payload);
    req.end();
  });
}

class PornhubScraper {
  constructor() {
    this.baseURL = 'https://www.pornhub.com';
    this.userAgent = UA;
  }
  
  async fetchHTML(url) {
    try {
      const res = await axios.get(url, {
        headers: { 
          'User-Agent': this.userAgent,
          'Referer': this.baseURL + '/',
          'Accept-Language': 'en-US,en;q=0.9',
        },
        timeout: 15000,
      });
      return res.data;
    } catch (err) {
      throw new Error('Fetch error: ' + err.message);
    }
  }
  
  async search(query, page = 1) {
    try {
      const url = `${this.baseURL}/video/search?search=${encodeURIComponent(query)}&page=${page}`;
      const html = await this.fetchHTML(url);
      const $ = cheerio.load(html);
      const results = [];
      
      $('li.pcVideoListItem, li.videoBox, div[class*="videoBox"]').each((_, el) => {
        try {
          const $el = $(el);
          const link = $el.find('a').first();
          const href = link.attr('href') || '';
          
          if (!href || !href.includes('view_video')) return;
          
          const title = link.attr('title') || link.text()?.trim() || $el.find('.title').text()?.trim() || 'No title';
          const thumb = $el.find('img').attr('data-thumb_url') || $el.find('img').attr('src') || null;
          const fullUrl = href.startsWith('http') ? href : this.baseURL + href;
          
          results.push({
            title: title.substring(0, 100),
            thumbnail: thumb,
            url: fullUrl
          });
        } catch(e) {}
      });
      
      // Dedupe
      const seen = new Set();
      const unique = [];
      for (const r of results) {
        if (r.url && !seen.has(r.url)) {
          seen.add(r.url);
          unique.push(r);
        }
      }
      
      return unique.length ? unique.slice(0, 10) : [];
    } catch(err) {
      log.error('Pornhub search error: ' + err.message);
      throw new Error('Pornhub search failed: ' + err.message);
    }
  }
}
const pornhubScraper = new PornhubScraper();

// ===== API ROUTES =====

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
    if (!Array.isArray(data) || data.length === 0) throw new Error('No data');
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
    if (!Array.isArray(data) || data.length === 0) throw new Error('No data');
    const rand = data[Math.floor(Math.random() * data.length)];
    if (!rand.url) throw new Error('Invalid data');
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
    if (action === "search") {
      if (!source || !query) return res.status(400).json({ error: "Missing source or query" });
      let list = [];
      if (source === "xv") {
        list = await scrapeXvideosSearch(query);
      } else if (source === "xn") {
        list = await scrapeXnxxSearch(query);
      }
      if (!list.length) return res.json({ message: "No videos found", results: [] });
      return res.json({ results: list });
    }
    return res.status(400).json({ error: "Invalid action" });
  } catch (err) {
    log.error('N18 error: ' + err.message);
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
    log.error('Pornhub search error: ' + err.message);
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
    log.error('Pornhub info error: ' + err.message);
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
    log.error('Anh.moe error: ' + err.message);
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
<h1>🚀 API Panel <span class="badge">${IS_VERCEL ? 'VERCEL' : 'TERMUX'}</span></h1>
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
if(!res.ok)throw new Error(data.error||'TikTok error');
resultEl.innerHTML='<div class="success-msg">Success!</div><pre>'+JSON.stringify(data,null,2)+'</pre>';
}else if(id==='ba'){
const res=await fetch('/random/ba');
if(!res.ok)throw new Error('Blue Archive error');
const blob=await res.blob();
resultEl.innerHTML='<img class="preview" src="'+URL.createObjectURL(blob)+'"/>';
}else if(id==='china'){
const res=await fetch('/random/china');
if(!res.ok)throw new Error('China error');
const blob=await res.blob();
resultEl.innerHTML='<img class="preview" src="'+URL.createObjectURL(blob)+'"/>';
}else if(id==='anhmoe'){
const res=await fetch('/api/anhmoe/random',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({category:selectedCategory})});
const data=await res.json();
if(!res.ok)throw new Error(data.error||'Anh.moe error');
const item=data.item;
if(item.image&&item.image.url){resultEl.innerHTML='<img class="preview" src="'+item.image.url+'"/>';}else if(item.video&&item.video.url){resultEl.innerHTML='<video class="preview" controls src="'+item.video.url+'"></video>';}else{resultEl.innerHTML='<div class="error-msg">No media found</div>';}
}else if(id==='ph_search'){
const q=document.getElementById('search-ph_search').value.trim();
if(!q)throw new Error('Query required');
const res=await fetch('/api/pornhub/search',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({query:q})});
const data=await res.json();
if(!res.ok)throw new Error(data.error||'Search error');
if(!data.results||data.results.length===0){resultEl.innerHTML='<div class="error-msg">No videos found</div>';return;}
let html='';
data.results.forEach(item=>{
const thumb=item.thumbnail?'<img src="'+item.thumbnail+'" onerror="this.style.display='+String.fromCharCode(39)+'none'+String.fromCharCode(39)+'"/>':'';
html+='<div class="result-item">'+thumb+'<strong>'+item.title.substring(0,50)+'...</strong><br><a href="'+item.url+'" target="_blank">Watch on Pornhub</a></div>';
});
resultEl.innerHTML=html;
}else if(id==='ph_info'){
const url=document.getElementById('ph-url').value.trim();
if(!url)throw new Error('URL required');
const res=await fetch('/api/pornhub/info',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({url:url})});
const data=await res.json();
if(!res.ok)throw new Error(data.error||'Info error');
resultEl.innerHTML='<div class="success-msg">Success!</div><pre>'+JSON.stringify(data,null,2)+'</pre>';
}else if(id==='xv'||id==='xn'){
const q=document.getElementById('search-'+id).value.trim();
if(!q)throw new Error('Query required');
const res=await fetch('/n18',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'search',source:id,query:q})});
const data=await res.json();
if(!res.ok)throw new Error(data.error||'Search error');
(data.message||'No videos found')+'</div>';return;}
let html='';
data.results.forEach((item,idx)=>{
html+='<div style="margin-bottom:10px;padding:10px;background:rgba(102,126,234,0.1);border-radius:4px"><strong>'+idx+'.</strong> '+item.title+'<br><small style="color:#94a3b8">URL: <a href="'+item.url+'" target="_blank" style="color:#667eea">'+item.url.substring(0,50)+'...</a></small></div>';
});
resultEl.innerHTML='<div class="success-msg">Found '+data.results.length+' results</div>'+html+'<pre style="margin-top:20px">'+JSON.stringify(data,null,2)+'</pre>';
}
}catch(err){
resultEl.innerHTML='<div class="error-msg">Error: '+err.message+'</div>';
}
}

renderEndpoints();
</script>
</body>
</html>`;