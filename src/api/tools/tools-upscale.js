// tools-upscale.js
import axios from "axios"
import FormData from "form-data"
import { Buffer } from "buffer"
import { fileTypeFromBuffer } from "file-type"
import { createApiKeyMiddleware } from "../../middleware/apikey.js"
import multer from "multer"

// Memory storage (Vercel friendly)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith("image/")) cb(null, true)
    else cb(new Error("Only image files are allowed!"), false)
  }
})

class PicsArtUpscaler {
  constructor() {
    this.authToken = null
    this.uploadUrl = "https://upload.picsart.com/files"
    this.enhanceUrl = "https://ai.picsart.com/gw1/diffbir-enhancement-service/v1.7.6"
    this.jsUrl = "https://picsart.com/-/landings/4.290.0/static/index-msH24PNW-B73n3SC9.js"
  }

  async getAuthToken() {
    if (this.authToken) return this.authToken
    const response = await axios.get(this.jsUrl, {
      headers: { "User-Agent": "Mozilla/5.0 Chrome/132" }
    })
    const tokenMatch = response.data.match(/"x-app-authorization":"Bearer ([^"]+)"/)
    if (!tokenMatch) throw new Error("Token not found")
    this.authToken = `Bearer ${tokenMatch[1]}`
    return this.authToken
  }

  async uploadBuffer(buffer) {
    await this.getAuthToken()
    const formData = new FormData()
    formData.append("type", "editing-temp-landings")
    formData.append("file", buffer, { filename: "image.jpeg", contentType: "image/jpeg" })
    formData.append("url", "")
    formData.append("metainfo", "")

    const response = await axios.post(this.uploadUrl, formData, { headers: formData.getHeaders() })
    return response.data.result.url
  }

  async uploadFromUrl(imageUrl) {
    const imageResponse = await axios.get(imageUrl, { responseType: "arraybuffer" })
    return this.uploadBuffer(Buffer.from(imageResponse.data))
  }

  async enhanceImage(imageUrl, targetScale = 4) {
    await this.getAuthToken()
    const payload = {
      image_url: imageUrl,
      face_enhancement: { enabled: true, blending: 1, gfpgan: true },
      upscale: { enabled: true, node: "esrgan", target_scale: targetScale }
    }
    const params = new URLSearchParams({ picsart_cdn_url: imageUrl, format: "PNG", model: "REALESERGAN" })
    const response = await axios.post(`${this.enhanceUrl}?${params}`, payload, {
      headers: { "x-app-authorization": this.authToken }
    })
    return response.data
  }

  async checkStatus(jobId) {
    const response = await axios.get(`${this.enhanceUrl}/${jobId}`, {
      headers: { "x-app-authorization": this.authToken }
    })
    return response.data
  }

  async waitForCompletion(jobId) {
    while (true) {
      const status = await this.checkStatus(jobId)
      if (status.status === "DONE") return status.result.image_url
      if (status.status === "FAILED") throw new Error(status.error_message || "Enhancement failed")
      await new Promise(r => setTimeout(r, 2000))
    }
  }

  async downloadBuffer(url) {
    const response = await axios.get(url, { responseType: "arraybuffer" })
    return Buffer.from(response.data)
  }

  async upscale(input, targetScale = 4) {
    let uploadedUrl
    if (Buffer.isBuffer(input)) uploadedUrl = await this.uploadBuffer(input)
    else if (typeof input === "string") uploadedUrl = await this.uploadFromUrl(input)
    else throw new Error("Input must be Buffer or URL string")

    const enhanceResponse = await this.enhanceImage(uploadedUrl, targetScale)
    const resultUrl = await this.waitForCompletion(enhanceResponse.id)
    return this.downloadBuffer(resultUrl)
  }
}

const upscaler = new PicsArtUpscaler()

export default (app) => {
  // GET: upscale from URL
  app.get("/tools/upscale", createApiKeyMiddleware(), async (req, res) => {
    try {
      const { url, scale } = req.query
      if (!url) return res.status(400).json({ status: false, error: "Parameter 'url' is required" })
      const targetScale = scale ? parseInt(scale) : 4
      if (isNaN(targetScale) || targetScale < 1 || targetScale > 20) {
        return res.status(400).json({ status: false, error: "Scale must be 1-20" })
      }

      new URL(url.trim()) // validate URL
      const result = await upscaler.upscale(url.trim(), targetScale)

      res.setHeader("Content-Type", "image/png")
      res.setHeader("Content-Length", result.length)
      res.setHeader("Cache-Control", "public, max-age=3600")
      res.setHeader("Content-Disposition", `inline; filename="upscaled_${Date.now()}.png"`)
      res.end(result)
    } catch (error) {
      res.status(500).json({ status: false, error: error.message || "Internal Server Error" })
    }
  })

  // POST: upscale from file
  app.post("/tools/upscale", createApiKeyMiddleware(), upload.single("image"), async (req, res) => {
    try {
      if (!req.file) return res.status(400).json({ status: false, error: "File 'image' is required" })
      const targetScale = req.body.scale ? parseInt(req.body.scale) : 4
      if (isNaN(targetScale) || targetScale < 1 || targetScale > 20) {
        return res.status(400).json({ status: false, error: "Scale must be 1-20" })
      }

      const fileType = await fileTypeFromBuffer(req.file.buffer)
      if (!fileType || !fileType.mime.startsWith("image/")) {
        return res.status(400).json({ status: false, error: "Unsupported file type" })
      }

      const result = await upscaler.upscale(req.file.buffer, targetScale)

      res.setHeader("Content-Type", "image/png")
      res.setHeader("Content-Length", result.length)
      res.setHeader("Cache-Control", "public, max-age=3600")
      res.setHeader("Content-Disposition", `inline; filename="upscaled_${Date.now()}.png"`)
      res.end(result)
    } catch (error) {
      res.status(500).json({ status: false, error: error.message || "Internal Server Error" })
    }
  })
}