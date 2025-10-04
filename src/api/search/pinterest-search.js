import axios from "axios"
import cheerio from "cheerio"
import { createApiKeyMiddleware } from "../../middleware/apikey.js"

class PinterestScraper {
  constructor() {
    this.userAgent = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36"
  }

  async searchPins(query) {
    if (!query) {
      return {
        status: false,
        code: 400,
        result: { message: "Query parameter is required" }
      }
    }

    try {
      // Pertama ambil cookie dari homepage Pinterest
      const homeResp = await axios.get("https://id.pinterest.com/", {
        headers: { "User-Agent": this.userAgent }
      })
      const setCookieHeader = homeResp.headers["set-cookie"] || []
      const cookie = setCookieHeader.map(c => c.split(";")[0]).join("; ")

      // Ambil halaman hasil pencarian pins
      const searchResp = await axios.get(`https://id.pinterest.com/search/pins/?autologin=true&q=${encodeURIComponent(query)}`, {
        headers: {
          "User-Agent": this.userAgent,
          Cookie: cookie
        }
      })

      // Parsing HTML dengan cheerio
      const $ = cheerio.load(searchResp.data)
      const pins = []

      $("div > a").each((i, el) => {
        const img = $(el).find("img").attr("src")
        if (img) {
          pins.push({
            type: "image",
            quality: "high",
            url: img.replace(/236/g, "736"), // Ganti ukuran gambar ke lebih besar
          })
        }
      })

      if (pins.length === 0) {
        return {
          status: false,
          code: 404,
          result: { message: "No pins found for query" }
        }
      }

      return {
        status: true,
        code: 200,
        result: {
          query,
          count: pins.length,
          pins
        }
      }
    } catch (error) {
      return {
        status: false,
        code: error.response?.status || 500,
        result: { message: error.message || "Server error" }
      }
    }
  }
}

const pinterestScraper = new PinterestScraper()

export default (app) => {
  app.get("/search/pinterest", createApiKeyMiddleware(), async (req, res) => {
    const { q } = req.query
    const result = await pinterestScraper.searchPins(q)
    res.status(result.code).json(result)
  })

  app.post("/search/pinterest", createApiKeyMiddleware(), async (req, res) => {
    const { query } = req.body
    const result = await pinterestScraper.searchPins(query)
    res.status(result.code).json(result)
  })
}