import axios from "axios"
import { createApiKeyMiddleware } from "../../middleware/apikey.js"

export default (app) => {
  async function getRandomAnimeNekoImage(res) {
    try {
      const API_URL = "https://api.waifu.pics/sfw/neko"

      // Ambil link gambar
      const { data } = await axios.get(API_URL, {
        timeout: 30000,
        headers: { "User-Agent": "Mozilla/5.0" },
      })

      if (!data?.url) throw new Error("Invalid API response: no image URL")

      // Ambil stream gambar
      const response = await axios.get(data.url, {
        responseType: "stream",
        timeout: 30000,
        headers: { "User-Agent": "Mozilla/5.0" },
      })

      // Deteksi MIME type dari header
      const contentType = response.headers["content-type"] || "image/jpeg"
      res.writeHead(200, {
        "Content-Type": contentType,
        "Cache-Control": "public, max-age=3600",
        "Content-Disposition": `inline; filename="neko_${Date.now()}.${
          contentType.split("/")[1]
        }"`
      })

      // Stream langsung ke response
      response.data.pipe(res)
    } catch (error) {
      console.error("API Error:", error.message)
      res.status(500).json({
        status: false,
        error: error.message || "Failed to fetch neko image",
      })
    }
  }

  // GET endpoint
  app.get("/api/r/neko", createApiKeyMiddleware(), async (req, res) => {
    await getRandomAnimeNekoImage(res)
  })

  // POST endpoint
  app.post("/api/r/neko", createApiKeyMiddleware(), async (req, res) => {
    await getRandomAnimeNekoImage(res)
  })
}