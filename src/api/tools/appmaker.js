// tools-appmaker.js
import axios from "axios"
import FormData from "form-data"
import { createApiKeyMiddleware } from "../../middleware/apikey.js"

class Appmaker {
  constructor() {
    this.defaultHeaders = {
      "User-Agent": "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Mobile Safari/537.36",
      Accept: "application/json, text/plain, */*",
      "Accept-Encoding": "gzip, deflate, br, zstd",
      "sec-ch-ua-platform": '"Android"',
      "sec-ch-ua": '"Not;A=Brand";v="99", "Google Chrome";v="139", "Chromium";v="139"',
      dnt: "1",
      "sec-ch-ua-mobile": "?1",
      origin: "https://create.appmaker.xyz",
      "sec-fetch-site": "same-site",
      "sec-fetch-mode": "cors",
      "sec-fetch-dest": "empty",
      referer: "https://create.appmaker.xyz/",
      "accept-language": "id,en-US;q=0.9,en;q=0.8,ja;q=0.7",
      priority: "u=1, i",
    }
  }

  async createApp(url, email) {
    const config = {
      method: "POST",
      url: "https://standalone-app-api.appmaker.xyz/webapp/build",
      headers: { ...this.defaultHeaders, "Content-Type": "application/json" },
      data: JSON.stringify({ url, email }),
    }
    const res = await axios.request(config)
    return res.data
  }

  async uploadFile(fileUrl, appId, field = "file") {
    const data = new FormData()
    data.append(field, fileUrl) // langsung URL, bukan fs.createReadStream
    data.append("id", appId)

    const config = {
      method: "POST",
      url: "https://standalone-app-api.appmaker.xyz/webapp/build/file-upload",
      headers: { ...this.defaultHeaders, ...data.getHeaders() },
      data,
    }
    const res = await axios.request(config)
    return res.data
  }

  async buildApp(appConfig) {
    const config = {
      method: "POST",
      url: "https://standalone-app-api.appmaker.xyz/webapp/build/build",
      headers: { ...this.defaultHeaders, "Content-Type": "application/json" },
      data: JSON.stringify(appConfig),
    }
    const res = await axios.request(config)
    return res.data
  }

  async checkStatus(appId) {
    const config = {
      method: "GET",
      url: `https://standalone-app-api.appmaker.xyz/webapp/build/status?appId=${appId}`,
      headers: this.defaultHeaders,
    }
    const res = await axios.request(config)
    return res.data
  }

  async getDownloadUrl(appId) {
    const config = {
      method: "GET",
      url: `https://standalone-app-api.appmaker.xyz/webapp/complete/download?appId=${appId}`,
      headers: this.defaultHeaders,
    }
    const res = await axios.request(config)
    return res.data
  }

  async create({ url, email, appName, icon, splash }) {
    // 1. create app
    const createResult = await this.createApp(url, email)
    const appId = createResult.body.appId

    // 2. upload icon & splash (pakai URL string)
    const iconUpload = await this.uploadFile(icon, appId)
    const splashUpload = await this.uploadFile(splash, appId)

    // 3. build app
    const appConfig = {
      appId,
      appIcon: iconUpload.cloudStoragePublicUrl,
      appName,
      isPaymentInProgress: false,
      enableShowToolBar: true,
      toolbarColor: "#03A9F4",
      toolbarTitleColor: "#FFFFFF",
      splashIcon: splashUpload.cloudStoragePublicUrl,
    }
    await this.buildApp(appConfig)

    // 4. tunggu sampai selesai
    let status, attempts = 0
    const maxAttempts = 30
    do {
      await new Promise(r => setTimeout(r, 10000))
      status = await this.checkStatus(appId)
      attempts++
      if (status.body.status === "success") break
      if (status.body.status === "failed") throw new Error("Build failed")
    } while (attempts < maxAttempts)

    // 5. ambil download URL
    const downloadInfo = await this.getDownloadUrl(appId)
    return downloadInfo.body
  }
}

const appmaker = new Appmaker()

export default (app) => {
  app.get("/api/tools/appmaker", createApiKeyMiddleware(), async (req, res) => {
    try {
      const { url, email, appName, icon, splash } = req.query
      if (!url || !email || !appName || !icon || !splash) {
        return res.status(400).json({ status: false, error: "Missing required parameters" })
      }

      const result = await appmaker.create({ url, email, appName, icon, splash })
      res.status(200).json({ status: true, data: result, timestamp: new Date().toISOString() })
    } catch (e) {
      res.status(500).json({ status: false, error: e.message })
    }
  })

  app.post("/api/tools/appmaker", createApiKeyMiddleware(), async (req, res) => {
    try {
      const { url, email, appName, icon, splash } = req.body
      if (!url || !email || !appName || !icon || !splash) {
        return res.status(400).json({ status: false, error: "Missing required parameters" })
      }

      const result = await appmaker.create({ url, email, appName, icon, splash })
      res.status(200).json({ status: true, data: result, timestamp: new Date().toISOString() })
    } catch (e) {
      res.status(500).json({ status: false, error: e.message })
    }
  })
}
