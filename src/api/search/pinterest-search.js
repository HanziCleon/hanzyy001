// search-pinterest.js
import axios from "axios"
import cheerio from "cheerio"
import { createApiKeyMiddleware } from "../../middleware/apikey.js"

class PinterestSearch {
  constructor() {
    this.baseUrl = "https://id.pinterest.com"
    this.headers = {
      "User-Agent":
        "Mozilla/5.0 (Linux; Android 10; Mobile; rv:117.0) Gecko/117.0 Firefox/117.0",
    }
  }

  async getCookies() {
    try {
      const resp = await axios.get(this.baseUrl, { headers: this.headers })
      const setCookieHeader = resp.headers["set-cookie"] || []
      return setCookieHeader.map((c) => c.split(";")[0]).join("; ")
    } catch (e) {
      return ""
    }
  }

  async search({ query }) {
    if (!query) {
      return {
        status: false,
        code: 400,
        result: { message: "Query parameter is required" },
      }
    }

    try {
      const cookie = await this.getCookies()
      const { data } = await axios.get(
        `${this.baseUrl}/search/pins/?autologin=true&q=${encodeURIComponent(query)}`,
        {
          headers: { ...this.headers, Cookie: cookie },
        }
      )

      const $ = cheerio.load(data)
      const result = []

      $("div > a").each((_, el) => {
        const link = $(el).find("img").attr("src")
        if (link) result.push(link.replace(/236/g, "736"))
      })

      if (!result.length) {
        return {
          status: false,
          code: 404,
          result: { message: "No images found." },
        }
      }

      // ambil 5 gambar acak
      const shuffled = result.sort(() => 0.5 - Math.random())
      const images = shuffled.slice(0, 5)

      return {
        status: true,
        code: 200,
        result: {
          query,
          count: images.length,
          images,
        },
      }
    } catch (error) {
      return {
        status: false,
        code: error.response?.status || 500,
        result: { message: error.message || "Internal Server Error" },
      }
    }
  }
}

const pinterestSearch = new PinterestSearch()

export default (app) => {
  // GET endpoint
  app.get("/search/pinterest", createApiKeyMiddleware(), async (req, res) => {
    const { q } = req.query
    if (!q) return res.status(400).json({ status: false, error: "Missing query param `q`" })

    const result = await pinterestSearch.search({ query: q.trim() })
    if (!result.status) {
      return res.status(result.code).json({ status: false, error: result.result.message })
    }

    res.status(200).json({ status: true, data: result.result, timestamp: new Date().toISOString() })
  })

  // POST endpoint
  app.post("/search/pinterest", createApiKeyMiddleware(), async (req, res) => {
    const { q } = req.body
    if (!q) return res.status(400).json({ status: false, error: "Missing query param `q`" })

    const result = await pinterestSearch.search({ query: q.trim() })
    if (!result.status) {
      return res.status(result.code).json({ status: false, error: result.result.message })
    }

    res.status(200).json({ status: true, data: result.result, timestamp: new Date().toISOString() })
  })
}
