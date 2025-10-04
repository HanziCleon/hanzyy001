import axios from "axios"
import { createApiKeyMiddleware } from "../../middleware/apikey.js"

export default (app) => {
  async function getRandomWaifuImage() {
    try {
      const API_URL = "https://api.waifu.pics/sfw/waifu"
      const { data } = await axios.get(API_URL, {
        timeout: 30000,
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
        },
      })

      if (!data || !data.url) {
        throw new Error("Invalid response from external API: Missing image URL.")
      }

      // Ambil binary dari URL gambar
      const imageResponse = await axios.get(data.url, {
        responseType: "arraybuffer",
        timeout: 30000,
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
        },
      })
      return Buffer.from(imageResponse.data, "binary")
    } catch (error) {
      console.error("API Error:", error.message)
      throw new Error("Failed to get random waifu image from API")
    }
  }

  // GET endpoint
  app.get("/api/r/waifu", createApiKeyMiddleware(), async (req, res) => {
    try {
      const imageBuffer = await getRandomWaifuImage()
      res.writeHead(200, {
        "Content-Type": "image/jpeg",
        "Content-Length": imageBuffer.length,
        "Cache-Control": "public, max-age=3600",
        "Content-Disposition": `inline; filename="waifu_${Date.now()}.jpg"`,
      })
      res.end(imageBuffer)
    } catch (error) {
      res.status(500).json({
        status: false,
        error: error.message || "Failed to fetch waifu image",
      })
    }
  })

  // POST endpoint
  app.post("/api/r/waifu", createApiKeyMiddleware(), async (req, res) => {
    try {
      const imageBuffer = await getRandomWaifuImage()
      res.writeHead(200, {
        "Content-Type": "image/jpeg",
        "Content-Length": imageBuffer.length,
        "Cache-Control": "public, max-age=3600",
        "Content-Disposition": `inline; filename="waifu_${Date.now()}.jpg"`,
      })
      res.end(imageBuffer)
    } catch (error) {
      res.status(500).json({
        status: false,
        error: error.message || "Failed to fetch waifu image",
      })
    }
  })
}