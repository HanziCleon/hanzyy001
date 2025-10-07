import express from "express"
import chalk from "chalk"
import fs from "fs"
import cors from "cors"
import path from "path"
import { fileURLToPath, pathToFileURL } from "url"
import { createRequire } from "module"
import dotenv from "dotenv"

dotenv.config()

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const require = createRequire(import.meta.url)

const app = express()
let PORT = process.env.PORT || 3000

app.enable("trust proxy")
app.set("json spaces", 2)

app.use(express.json())
app.use(express.urlencoded({ extended: false }))
app.use(cors())

app.use((req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff")
  res.setHeader("X-Frame-Options", "DENY")
  res.setHeader("X-XSS-Protection", "1; mode=block")
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin")
  next()
})

const requestCounts = new Map()
const RATE_LIMIT_WINDOW = 1 * 60 * 1000
const RATE_LIMIT_MAX = 50

// Stats tracking (in-memory)
let statsData = {
  totalRequests: 0,
  requestsByTime: new Map(),
  requestsByEndpoint: new Map(),
  startTime: Date.now(),
  lastReset: Date.now()
}

function updateStats(endpoint = 'unknown') {
  statsData.totalRequests++
  const now = Date.now()
  const timeKey = Math.floor(now / 60000)
  
  if (!statsData.requestsByTime.has(timeKey)) {
    statsData.requestsByTime.set(timeKey, 0)
  }
  statsData.requestsByTime.set(timeKey, statsData.requestsByTime.get(timeKey) + 1)
  
  if (!statsData.requestsByEndpoint.has(endpoint)) {
    statsData.requestsByEndpoint.set(endpoint, 0)
  }
  statsData.requestsByEndpoint.set(endpoint, statsData.requestsByEndpoint.get(endpoint) + 1)
}

app.use((req, res, next) => {
  try {
    const settings = JSON.parse(fs.readFileSync(path.join(__dirname, "./src/settings.json"), "utf-8"))
    
    const isApiEndpoint = req.path.startsWith('/api/') || 
                         req.path.startsWith('/ai/') || 
                         req.path.startsWith('/random/') || 
                         req.path.startsWith('/maker/')
    
    if (isApiEndpoint) {
      updateStats(req.path)
    }
    
    if (isApiEndpoint && settings.apiSettings && settings.apiSettings.requireApikey === false) {
      return next()
    }
  } catch (error) {
    console.error("Error loading settings for rate limiting:", error)
  }

  const ip = req.ip || req.connection.remoteAddress
  const now = Date.now()

  if (!requestCounts.has(ip)) {
    requestCounts.set(ip, { count: 1, resetTime: now + RATE_LIMIT_WINDOW })
  } else {
    const data = requestCounts.get(ip)
    if (now > data.resetTime) {
      data.count = 1
      data.resetTime = now + RATE_LIMIT_WINDOW
    } else {
      data.count++
      if (data.count > RATE_LIMIT_MAX) {
        return res.status(429).sendFile(path.join(__dirname, "page", "status", "4xx", "429.html"))
      }
    }
  }
  next()
})

setInterval(() => {
  const now = Date.now()
  for (const [ip, data] of requestCounts.entries()) {
    if (now > data.resetTime) {
      requestCounts.delete(ip)
    }
  }
}, RATE_LIMIT_WINDOW)

app.use((req, res, next) => {
  try {
    const settings = JSON.parse(fs.readFileSync(path.join(__dirname, "./src/settings.json"), "utf-8"))

    const skipPaths = ["/api/settings", "/assets/", "/src/", "/api/preview-image", "/src/sponsor.json", "/support"]
    const shouldSkip = skipPaths.some((path) => req.path.startsWith(path))

    if (settings.maintenance && settings.maintenance.enabled && !shouldSkip) {
      if (req.path.startsWith("/api/") || req.path.startsWith("/ai/")) {
        return res.status(503).json({
          status: false,
          error: "Service temporarily unavailable",
          message: "The API is currently under maintenance. Please try again later.",
          maintenance: true,
          creator: settings.apiSettings?.creator || "VGX Team",
        })
      }

      return res.status(503).sendFile(path.join(__dirname, "page", "status", "maintenance", "maintenance.html"))
    }

    next()
  } catch (error) {
    console.error("Error checking maintenance mode:", error)
    next()
  }
})

app.get("/assets/styles.css", (req, res) => {
  res.setHeader("Content-Type", "text/css")
  res.sendFile(path.join(__dirname, "page", "docs", "styles.css"))
})

app.get("/assets/script.js", (req, res) => {
  res.setHeader("Content-Type", "application/javascript")
  res.sendFile(path.join(__dirname, "page", "docs", "script.js"))
})

app.get("/page/sponsor.json", (req, res) => {
  try {
    const sponsorData = JSON.parse(fs.readFileSync(path.join(__dirname, "src", "sponsor.json"), "utf-8"))
    res.json(sponsorData)
  } catch (error) {
    res.status(500).json({ error: "Failed to load sponsor data" })
  }
})

app.get("/api/preview-image", (req, res) => {
  try {
    const previewImagePath = path.join(__dirname, "src", "images", "preview.png")

    if (fs.existsSync(previewImagePath)) {
      res.setHeader("Content-Type", "image/png")
      res.setHeader("Cache-Control", "public, max-age=86400")
      res.sendFile(previewImagePath)
    } else {
      const bannerPath = path.join(__dirname, "src", "images", "banner.jpg")
      if (fs.existsSync(bannerPath)) {
        res.setHeader("Content-Type", "image/jpeg")
        res.setHeader("Cache-Control", "public, max-age=86400")
        res.sendFile(bannerPath)
      } else {
        const iconPath = path.join(__dirname, "src", "images", "icon.png")
        res.setHeader("Content-Type", "image/png")
        res.setHeader("Cache-Control", "public, max-age=86400")
        res.sendFile(iconPath)
      }
    }
  } catch (error) {
    console.error("Error serving preview image:", error)
    res.status(404).json({ error: "Preview image not found" })
  }
})

app.get("/api/settings", (req, res) => {
  try {
    const settings = JSON.parse(fs.readFileSync(path.join(__dirname, "src", "settings.json"), "utf-8"))
    res.json(settings)
  } catch (error) {
    res.status(500).sendFile(path.join(__dirname, "page", "status", "5xx", "500.html"))
  }
})

app.get("/api/notifications", (req, res) => {
  try {
    const notifications = JSON.parse(fs.readFileSync(path.join(__dirname, "src", "notifications.json"), "utf-8"))
    res.json(notifications)
  } catch (error) {
    res.status(500).sendFile(path.join(__dirname, "page", "status", "5xx", "500.html"))
  }
})

app.get("/support", (req, res) => {
  res.sendFile(path.join(__dirname, "page", "support.html"))
})

app.use((req, res, next) => {
  const blockedPaths = [
    "/page/",
    "/src/settings.json",
    "/src/notifications.json",
    "/page/styles.css",
    "/page/script.js",
  ]

  const isBlocked = blockedPaths.some((blocked) => {
    if (blocked.endsWith("/")) {
      return req.path.startsWith(blocked)
    }
    return req.path === blocked
  })

  if (isBlocked) {
    return res.status(403).sendFile(path.join(__dirname, "page", "status", "4xx", "403.html"))
  }
  next()
})

app.use("/src/images", express.static(path.join(__dirname, "src", "images")))

app.use("/src", (req, res, next) => {
  if (req.path.match(/\.(jpg|jpeg|png|gif|svg|ico)$/i)) {
    express.static(path.join(__dirname, "src"))(req, res, next)
  } else {
    res.status(403).sendFile(path.join(__dirname, "page", "status", "4xx", "403.html"))
  }
})

const settingsPath = path.join(__dirname, "./src/settings.json")
const settings = JSON.parse(fs.readFileSync(settingsPath, "utf-8"))

app.use((req, res, next) => {
  const originalJson = res.json
  res.json = function (data) {
    if (data && typeof data === "object") {
      const responseData = {
        status: data.status ?? true,
        creator: settings.apiSettings.creator || "RaolByte",
        ...data,
      }
      return originalJson.call(this, responseData)
    }
    return originalJson.call(this, data)
  }
  next()
})

let totalRoutes = 0
const apiFolder = path.join(__dirname, "./src/api")

const loadApiRoutes = async () => {
  const subfolders = fs.readdirSync(apiFolder)

  for (const subfolder of subfolders) {
    const subfolderPath = path.join(apiFolder, subfolder)
    if (fs.statSync(subfolderPath).isDirectory()) {
      const files = fs.readdirSync(subfolderPath)

      for (const file of files) {
        const filePath = path.join(subfolderPath, file)
        if (path.extname(file) === ".js") {
          try {
            const module = await import(pathToFileURL(filePath).href)
            const routeHandler = module.default
            if (typeof routeHandler === "function") {
              routeHandler(app)
              totalRoutes++
              console.log(
                chalk
                  .bgHex("#FFFF99")
                  .hex("#333")
                  .bold(` Loaded Route: ${path.basename(file)} `),
              )
            }
          } catch (error) {
            console.error(`Error loading route ${file}:`, error)
          }
        }
      }
    }
  }
}

await loadApiRoutes()

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "page", "index.html"))
})

app.get("/docs", (req, res) => {
  res.sendFile(path.join(__dirname, "page", "docs", "index.html"))
})

console.log(chalk.bgHex("#90EE90").hex("#333").bold(" Load Complete! "))
console.log(chalk.bgHex("#90EE90").hex("#333").bold(` Total Routes Loaded: ${totalRoutes} `))

app.use((err, req, res, next) => {
  console.error(err.stack)

  const errorPages = {
    400: "400.html", 401: "401.html", 402: "402.html", 403: "403.html",
    405: "405.html", 406: "406.html", 407: "407.html", 408: "408.html",
    409: "409.html", 410: "410.html", 411: "411.html", 412: "412.html",
    413: "413.html", 414: "414.html", 415: "415.html", 416: "416.html",
    417: "417.html", 418: "418.html", 421: "421.html", 422: "422.html",
    423: "423.html", 424: "424.html", 425: "425.html", 426: "426.html",
    428: "428.html", 429: "429.html", 431: "431.html", 451: "451.html",
    501: "501.html", 502: "502.html", 503: "503.html", 504: "504.html",
    505: "505.html", 506: "506.html", 507: "507.html", 508: "508.html",
    510: "510.html", 511: "511.html"
  }

  const statusCode = err.status || 500
  const errorFile = errorPages[statusCode] || "500.html"
  const statusCategory = statusCode >= 500 ? "5xx" : "4xx"
  
  res.status(statusCode).sendFile(path.join(__dirname, "page", "status", statusCategory, errorFile))
})

const findAvailablePort = (startPort) => {
  return new Promise((resolve) => {
    const server = app
      .listen(startPort, () => {
        const port = server.address().port
        server.close(() => resolve(port))
      })
      .on("error", () => {
        resolve(findAvailablePort(startPort + 1))
      })
  })
}

const startServer = async () => {
  try {
    PORT = await findAvailablePort(PORT)

    const server = app.listen(PORT, () => {
      console.log(chalk.bgHex("#90EE90").hex("#333").bold(` Server is running on port ${PORT} `))
    })

    process.on('SIGTERM', () => {
      console.log('SIGTERM received, shutting down gracefully')
      server.close(() => {
        console.log('Process terminated')
        process.exit(0)
      })
    })

    process.on('SIGINT', () => {
      console.log('SIGINT received, shutting down gracefully')
      server.close(() => {
        console.log('Process terminated')
        process.exit(0)
      })
    })
  } catch (err) {
    console.error(chalk.bgRed.white(` Server failed to start: ${err.message} `))
    process.exit(1)
  }
}

// Only start server if not in Vercel environment
if (process.env.VERCEL !== '1') {
  startServer()
}

export default app