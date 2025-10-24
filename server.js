import express from "express";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import chalk from "chalk";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

// Load settings
const settings = JSON.parse(fs.readFileSync("./settings.json", "utf-8"));
const PORT = process.env.PORT || settings.port;
const IS_VERCEL = !!process.env.VERCEL;

// ===== MIDDLEWARE =====
app.use(express.json({ limit: settings.requestLimit }));
app.use(express.urlencoded({ extended: true, limit: settings.requestLimit }));

// Simple Rate Limiter (in-memory)
const rateLimitStore = new Map();
export const rateLimit = (req, res, next) => {
  const ip = req.ip || req.connection.remoteAddress;
  const now = Date.now();
  
  if (!rateLimitStore.has(ip)) {
    rateLimitStore.set(ip, { count: 1, resetTime: now + settings.rateLimit.windowMs });
    return next();
  }
  
  const record = rateLimitStore.get(ip);
  
  if (now > record.resetTime) {
    record.count = 1;
    record.resetTime = now + settings.rateLimit.windowMs;
    return next();
  }
  
  if (record.count >= settings.rateLimit.maxRequests) {
    return res.status(429).json({
      success: false,
      error: "Too many requests. Please try again later.",
      retryAfter: Math.ceil((record.resetTime - now) / 1000)
    });
  }
  
  record.count++;
  next();
};

// Clean up rate limit store
setInterval(() => {
  const now = Date.now();
  for (const [ip, record] of rateLimitStore.entries()) {
    if (now > record.resetTime) {
      rateLimitStore.delete(ip);
    }
  }
}, 5 * 60 * 1000);

// Simple Cache (in-memory)
const cache = new Map();
export const cacheMiddleware = (duration = settings.cache.ttl) => (req, res, next) => {
  if (req.method !== "GET") return next();
  
  const key = req.originalUrl;
  const cached = cache.get(key);
  
  if (cached && (Date.now() - cached.timestamp < duration)) {
    return res.json({ ...cached.data, cached: true });
  }
  
  res.originalJson = res.json;
  res.json = function(data) {
    if (cache.size >= settings.cache.maxSize) {
      const firstKey = cache.keys().next().value;
      cache.delete(firstKey);
    }
    cache.set(key, { data, timestamp: Date.now() });
    return res.originalJson(data);
  };
  
  next();
};

// Apply rate limiting to all API routes
app.use("/api/", rateLimit);

// Request Logger
app.use((req, res, next) => {
  const start = Date.now();
  res.on("finish", () => {
    const duration = Date.now() - start;
    const status = res.statusCode;

    const paint =
      status >= 500 ? chalk.red :
      status >= 400 ? chalk.yellow :
      chalk.green;

    console.log(
      paint(
        `[${new Date().toISOString()}] ${req.method} ${req.path} ${status} ${duration}ms`
      )
    );
  });
  next();
});

// ===== UTILITIES =====
export const log = {
  success: (m) => console.log(chalk.green(`✅ ${m}`)),
  error: (m) => console.log(chalk.red(`❌ ${m}`)),
  info: (m) => console.log(chalk.blue(`ℹ️  ${m}`)),
  warn: (m) => console.log(chalk.yellow(`⚠️  ${m}`))
};

export const validate = {
  url: (url, domain = null) => {
    if (!url || typeof url !== "string") return false;
    try {
      const parsed = new URL(url);
      if (domain) return parsed.hostname.includes(domain);
      return parsed.protocol === "http:" || parsed.protocol === "https:";
    } catch {
      return false;
    }
  },
  notEmpty: (str) => str && typeof str === "string" && str.trim().length > 0
};

// ===== AUTO-LOAD ENDPOINTS =====
const endpoints = [];
const routerPath = path.join(__dirname, "router");

if (fs.existsSync(routerPath)) {
  const files = fs.readdirSync(routerPath).filter(f => f.endsWith(".js"));
  
  for (const file of files) {
    try {
      const module = await import(`./router/${file}`);
      if (module.default) {
        const endpoint = module.default;
        
        // Register route
        if (endpoint.method === "GET") {
          app.get(endpoint.path, endpoint.handler);
        } else if (endpoint.method === "POST") {
          app.post(endpoint.path, endpoint.handler);
        }
        
        // Store metadata for docs
        endpoints.push({
          name: endpoint.name,
          path: endpoint.path,
          method: endpoint.method,
          description: endpoint.description,
          category: endpoint.category || "Miscellaneous",
          params: endpoint.params || []
        });
        
        log.success(`Loaded: ${endpoint.method} ${endpoint.path}`);
      }
    } catch (err) {
      log.error(`Failed to load ${file}: ${err.message}`);
    }
  }
}

// Make endpoints available globally
app.locals.endpoints = endpoints;

// ===== HEALTH CHECK =====
app.get("/health", (req, res) => {
  res.json({
    status: "ok",
    uptime: Math.floor(process.uptime()),
    timestamp: new Date().toISOString(),
    cache_size: cache.size,
    rate_limit_ips: rateLimitStore.size,
    total_endpoints: endpoints.length
  });
});

// ===== API INFO =====
app.get("/api", (req, res) => {
  const groupedEndpoints = {};
  
  endpoints.forEach(ep => {
    if (!groupedEndpoints[ep.category]) {
      groupedEndpoints[ep.category] = [];
    }
    groupedEndpoints[ep.category].push({
      name: ep.name,
      path: ep.path,
      method: ep.method,
      description: ep.description,
      params: ep.params
    });
  });
  
  res.json({
    name: settings.name,
    version: settings.version,
    total_endpoints: endpoints.length,
    categories: groupedEndpoints,
    rate_limit: `${settings.rateLimit.maxRequests} requests per ${settings.rateLimit.windowMs / 60000} minutes`,
    cache_ttl: `${settings.cache.ttl / 1000} seconds`
  });
});

// ===== FRONTEND =====
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

// ===== DOCS PAGE =====
app.get("/docs", (req, res) => {
  const docsHTML = generateDocsHTML(endpoints);
  res.send(docsHTML);
});

// ===== ERROR HANDLER =====
app.use((err, req, res, next) => {
  log.error(`${req.method} ${req.path} - ${err.message}`);
  const statusCode = err.statusCode || 500;
  const message = err.message || "Internal Server Error";
  res.status(statusCode).json({
    success: false,
    error: message,
    path: req.path,
    timestamp: new Date().toISOString()
  });
});

// 404 Handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: "Endpoint not found",
    path: req.path,
    available_endpoints: "/api"
  });
});

// ===== DOCS HTML GENERATOR =====
function generateDocsHTML(endpoints) {
  const groupedEndpoints = {};
  endpoints.forEach(ep => {
    if (!groupedEndpoints[ep.category]) {
      groupedEndpoints[ep.category] = [];
    }
    groupedEndpoints[ep.category].push(ep);
  });

  let endpointsHTML = "";
  
  for (const [category, eps] of Object.entries(groupedEndpoints)) {
    const icon = getCategoryIcon(category);
    endpointsHTML += `
      <div class="category">
        <div class="category-title">${icon} ${category}</div>`;
    
    eps.forEach(ep => {
      const searchTerms = `${ep.name} ${ep.description} ${ep.path}`.toLowerCase();
      endpointsHTML += `
        <div class="endpoint" data-search="${searchTerms}">
          <div class="endpoint-header" onclick="toggleEndpoint(this)">
            <span class="method ${ep.method.toLowerCase()}">${ep.method}</span>
            <span class="endpoint-path">${ep.path}</span>
            <span class="endpoint-title">${ep.name}</span>
            <span class="expand-icon">▼</span>
          </div>
          <div class="endpoint-body">
            <div class="endpoint-content">
              <div class="description">${ep.description}</div>`;
      
      if (ep.params && ep.params.length > 0) {
        ep.params.forEach(param => {
          const required = param.required ? '<span class="required">*</span>' : '';
          const inputType = param.type === "textarea" ? "textarea" : 
                           param.type === "select" ? "select" : "input";
          
          endpointsHTML += `
              <div class="form-group">
                <label class="form-label">${param.name} ${required}</label>`;
          
          if (inputType === "textarea") {
            endpointsHTML += `<textarea placeholder="${param.placeholder || ''}" data-param="${param.name}"></textarea>`;
          } else if (inputType === "select" && param.options) {
            endpointsHTML += `<select data-param="${param.name}">`;
            param.options.forEach(opt => {
              endpointsHTML += `<option value="${opt.value}">${opt.label}</option>`;
            });
            endpointsHTML += `</select>`;
          } else {
            const inputTypeAttr = param.type === "number" ? "number" : "text";
            endpointsHTML += `<input type="${inputTypeAttr}" placeholder="${param.placeholder || ''}" data-param="${param.name}">`;
          }
          
          if (param.description) {
            endpointsHTML += `<div class="form-help">${param.description}</div>`;
          }
          endpointsHTML += `</div>`;
        });
      }
      
      const paramNames = ep.params ? ep.params.map(p => p.name) : [];
      const isBinary = ep.responseBinary || false;
      
      endpointsHTML += `
              <button class="btn-execute" onclick="executeRequest(this, '${ep.method}', '${ep.path}', ${JSON.stringify(paramNames)}, ${isBinary})">▶️ Execute</button>
              <div class="response-section"></div>
            </div>
          </div>
        </div>`;
    });
    
    endpointsHTML += `</div>`;
  }

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>API Documentation</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background: #0f172a; color: #e2e8f0; padding: 20px; }
    .container { max-width: 1400px; margin: 0 auto; }
    .header { background: linear-gradient(135deg, rgba(102,126,234,0.1), rgba(118,75,162,0.1)); border: 1px solid rgba(102,126,234,0.2); border-radius: 12px; padding: 30px; margin-bottom: 30px; }
    .header h1 { background: linear-gradient(135deg, #667eea, #764ba2); -webkit-background-clip: text; -webkit-text-fill-color: transparent; font-size: 2.5em; margin-bottom: 10px; }
    .header p { color: #94a3b8; font-size: 1.1em; }
    .search-box { background: rgba(30,41,59,0.5); border: 1px solid rgba(102,126,234,0.2); border-radius: 8px; padding: 12px 20px; margin-bottom: 30px; display: flex; align-items: center; gap: 10px; }
    .search-box input { flex: 1; background: transparent; border: none; color: #e2e8f0; font-size: 14px; outline: none; }
    .search-box input::placeholder { color: #64748b; }
    .category { margin-bottom: 40px; }
    .category-title { font-size: 1.5em; color: #667eea; margin-bottom: 20px; padding-bottom: 10px; border-bottom: 2px solid rgba(102,126,234,0.2); }
    .endpoint { background: rgba(30,41,59,0.5); border: 1px solid rgba(102,126,234,0.15); border-radius: 10px; margin-bottom: 15px; overflow: hidden; transition: all 0.3s; }
    .endpoint:hover { border-color: rgba(102,126,234,0.4); }
    .endpoint-header { padding: 20px; cursor: pointer; display: flex; align-items: center; gap: 15px; transition: background 0.2s; }
    .endpoint-header:hover { background: rgba(30,41,59,0.7); }
    .method { padding: 6px 12px; border-radius: 6px; font-weight: 600; font-size: 12px; min-width: 60px; text-align: center; }
    .method.get { background: rgba(34,197,94,0.2); color: #22c55e; }
    .method.post { background: rgba(59,130,246,0.2); color: #3b82f6; }
    .endpoint-path { font-family: "Courier New", monospace; color: #e2e8f0; font-size: 14px; flex: 1; }
    .endpoint-title { color: #94a3b8; font-size: 13px; }
    .expand-icon { color: #667eea; transition: transform 0.3s; }
    .endpoint.active .expand-icon { transform: rotate(180deg); }
    .endpoint-body { max-height: 0; overflow: hidden; transition: max-height 0.3s ease; border-top: 1px solid rgba(102,126,234,0.1); }
    .endpoint.active .endpoint-body { max-height: 2000px; }
    .endpoint-content { padding: 25px; background: rgba(15,23,42,0.5); }
    .description { color: #94a3b8; margin-bottom: 20px; line-height: 1.6; }
    .form-group { margin-bottom: 20px; }
    .form-label { display: block; color: #e2e8f0; font-size: 13px; font-weight: 600; margin-bottom: 8px; }
    .required { color: #ef4444; }
    .form-help { font-size: 12px; color: #64748b; margin-top: 4px; }
    input[type="text"], input[type="number"], textarea, select { width: 100%; padding: 12px 16px; background: rgba(30,41,59,0.6); border: 1px solid rgba(102,126,234,0.2); border-radius: 6px; color: #e2e8f0; font-size: 14px; font-family: inherit; transition: all 0.2s; }
    input:focus, textarea:focus, select:focus { outline: none; border-color: #667eea; background: rgba(30,41,59,0.8); }
    textarea { resize: vertical; min-height: 80px; font-family: "Courier New", monospace; }
    .btn-execute { background: linear-gradient(135deg, #667eea, #764ba2); color: white; border: none; padding: 12px 30px; border-radius: 6px; font-weight: 600; font-size: 14px; cursor: pointer; transition: all 0.2s; display: inline-flex; align-items: center; gap: 8px; }
    .btn-execute:hover { transform: translateY(-2px); box-shadow: 0 8px 20px rgba(102,126,234,0.3); }
    .btn-execute:active { transform: translateY(0); }
    .btn-execute:disabled { opacity: 0.5; cursor: not-allowed; transform: none; }
    .response-section { margin-top: 25px; display: none; }
    .response-section.show { display: block; }
    .response-header { display: flex; justify-content: between; align-items: center; margin-bottom: 10px; }
    .response-title { color: #667eea; font-weight: 600; font-size: 14px; }
    .response-time { color: #94a3b8; font-size: 12px; }
    .response-body { background: rgba(0,0,0,0.3); border: 1px solid rgba(102,126,234,0.2); border-radius: 6px; padding: 15px; max-height: 500px; overflow: auto; }
    pre { color: #e2e8f0; font-size: 12px; line-height: 1.6; white-space: pre-wrap; word-break: break-all; margin: 0; }
    .status-badge { display: inline-block; padding: 4px 10px; border-radius: 4px; font-size: 11px; font-weight: 600; margin-right: 10px; }
    .status-success { background: rgba(34,197,94,0.2); color: #22c55e; }
    .status-error { background: rgba(239,68,68,0.2); color: #ef4444; }
    .loading { display: inline-block; width: 14px; height: 14px; border: 2px solid rgba(255,255,255,0.3); border-top-color: white; border-radius: 50%; animation: spin 0.8s linear infinite; }
    @keyframes spin { to { transform: rotate(360deg); } }
    .back-link { display: inline-flex; align-items: center; gap: 8px; color: #667eea; text-decoration: none; font-size: 14px; margin-bottom: 20px; transition: all 0.2s; }
    .back-link:hover { gap: 12px; }
    ::-webkit-scrollbar { width: 8px; height: 8px; }
    ::-webkit-scrollbar-track { background: rgba(30,41,59,0.5); }
    ::-webkit-scrollbar-thumb { background: rgba(102,126,234,0.3); border-radius: 4px; }
    ::-webkit-scrollbar-thumb:hover { background: rgba(102,126,234,0.5); }
  </style>
</head>
<body>
  <div class="container">
    <a href="/" class="back-link">← Back to Home</a>
    <div class="header">
      <h1>📚 API Documentation</h1>
      <p>Interactive documentation with live testing for all ${endpoints.length} endpoints</p>
    </div>
    <div class="search-box">
      <span>🔍</span>
      <input type="text" id="searchInput" placeholder="Search endpoints..." onkeyup="filterEndpoints()">
    </div>
    <div id="endpoints">
      ${endpointsHTML}
    </div>
  </div>
  <script>
    function toggleEndpoint(header) {
      const endpoint = header.parentElement;
      const wasActive = endpoint.classList.contains('active');
      document.querySelectorAll('.endpoint').forEach(ep => ep.classList.remove('active'));
      if (!wasActive) endpoint.classList.add('active');
    }
    function filterEndpoints() {
      const searchTerm = document.getElementById('searchInput').value.toLowerCase();
      const endpoints = document.querySelectorAll('.endpoint');
      const categories = document.querySelectorAll('.category');
      endpoints.forEach(endpoint => {
        const searchData = endpoint.getAttribute('data-search').toLowerCase();
        endpoint.style.display = searchData.includes(searchTerm) ? 'block' : 'none';
      });
      categories.forEach(category => {
        const visibleEndpoints = category.querySelectorAll('.endpoint');
        const hasVisible = Array.from(visibleEndpoints).some(ep => ep.style.display !== 'none');
        category.style.display = hasVisible || searchTerm === '' ? 'block' : 'none';
      });
    }
    async function executeRequest(button, method, path, params, isBinary = false) {
      const content = button.parentElement;
      const responseSection = content.querySelector('.response-section');
      const startTime = Date.now();
      button.disabled = true;
      button.innerHTML = '<span class="loading"></span> Loading...';
      responseSection.innerHTML = '';
      responseSection.classList.add('show');
      try {
        const body = {};
        let url = path;
        params.forEach(param => {
          const input = content.querySelector(\`[data-param="\${param}"]\`);
          if (input) {
            const value = input.value.trim();
            if (value) {
              if (method === 'GET') {
                url += (url.includes('?') ? '&' : '?') + param + '=' + encodeURIComponent(value);
              } else {
                body[param] = value;
              }
            }
          }
        });
        const options = { method: method, headers: {} };
        if (method === 'POST') {
          options.headers['Content-Type'] = 'application/json';
          options.body = JSON.stringify(body);
        }
        const response = await fetch(url, options);
        const duration = Date.now() - startTime;
        if (isBinary) {
          if (response.ok) {
            const blob = await response.blob();
            const imageUrl = URL.createObjectURL(blob);
            responseSection.innerHTML = \`
              <div class="response-header">
                <div><span class="status-badge status-success">200 OK</span><span class="response-title">Response</span></div>
                <span class="response-time">\${duration}ms</span>
              </div>
              <div class="response-body"><img src="\${imageUrl}" style="max-width: 100%; border-radius: 8px;" /></div>
            \`;
          } else {
            throw new Error(\`HTTP \${response.status}: \${response.statusText}\`);
          }
        } else {
          const data = await response.json();
          const statusClass = response.ok ? 'status-success' : 'status-error';
          responseSection.innerHTML = \`
            <div class="response-header">
              <div><span class="status-badge \${statusClass}">\${response.status} \${response.statusText}</span><span class="response-title">Response</span></div>
              <span class="response-time">\${duration}ms</span>
            </div>
            <div class="response-body"><pre>\${JSON.stringify(data, null, 2)}</pre></div>
          \`;
        }
      } catch (error) {
        const duration = Date.now() - startTime;
        responseSection.innerHTML = \`
          <div class="response-header">
            <div><span class="status-badge status-error">ERROR</span><span class="response-title">Response</span></div>
            <span class="response-time">\${duration}ms</span>
          </div>
          <div class="response-body"><pre style="color: #ef4444;">\${error.message}</pre></div>
        \`;
      } finally {
        button.disabled = false;
        button.innerHTML = '▶️ Execute';
      }
    }
  </script>
</body>
</html>`;
}

function getCategoryIcon(category) {
  const icons = {
    "Social Media Downloads": "📱",
    "Search Engines": "🔎",
    "Image Processing": "🎨",
    "Anime & Manga": "🎌",
    "Random Images": "🎲",
    "News & Miscellaneous": "📰",
    "Miscellaneous": "🔧"
  };
  return icons[category] || "📦";
}

export default app;
