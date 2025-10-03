// search-pinterest.js
import axios from "axios"
import cheerio from "cheerio"
import { createApiKeyMiddleware } from "../../middleware/apikey.js"

class PinterestSearch {
  constructor() {
    this.baseUrl = "https://id.pinterest.com"
    this.headers = {
      "User-Agent": "Mozilla/5.0 (Linux; Android 10; Mobile; rv:109.0) Gecko/117.0 Firefox/117.0",
    }
    this.client = axios.create({
      baseURL: this.baseUrl,
      headers: this.headers,
    })
    this.cookies = ""
    this.client.interceptors.response.use(
      (response) => {
        const setCookieHeaders = response.headers["set-cookie"]
        if (setCookieHeaders) {
          const newCookies = setCookieHeaders.map((cookieString) => {
            const cp = cookieString.split(";")
            return cp[0].trim()
          })
          this.cookies = newCookies.join("; ")
          this.client.defaults.headers.cookie = this.cookies
        }
        return response
      },
      (error) => Promise.reject(error),
    )
  }

  async initCookies() {
    try {
      await this.client.get("/")
      return true
    } catch (error) {
      return false
    }
  }

  async search({ query }) {
    if (!query) {
      return {
        status: false,
        code: 400,
        result: { message: "Query parameter is required." },
      }
    }

    try {
      if (!this.cookies) {
        const success = await this.initCookies()
        if (!success) {
          return {
            status: false,
            code: 400,
            result: { message: "Failed to retrieve cookies." },
          }
        }
      }

      const { data } = await this.client.get(`/search/pins/?autologin=true&q=${encodeURIComponent(query)}`)
      const $ = cheerio.load(data)
      const result = []

      $("div > a").get().map((b) => {
        const link = $(b).find("img").attr("src")
        if (link) result.push(link.replace(/236/g, "736"))
      })

      if (!result.length) {
        return { status: false, code: 404, result: { message: "No images found." } }
      }

      return {
        status: true,
        code: 200,
        result: {
          query,
          images: result, // semua hasil
        },
      }
    } catch (error) {
      return {
        status: false,
        code: error.response?.status || 500,
        result: { message: "Server error, please try again later." },
      }
    }
  }
}

const pinterestSearch = new PinterestSearch()

export default (app) => {
  // GET endpoint
  app.get("/search/pinterest", createApiKeyMiddleware(), async (req, res) => {
    try {
      const { q } = req.query
      if (!q) return res.status(400).json({ status: false, error: "Query parameter is required" })

      const result = await pinterestSearch.search({ query: q.trim() })
      if (!result.status) {
        return res.status(result.code).json({ status: false, error: result.result.message })
      }

      res.status(200).json({ status: true, data: result.result, timestamp: new Date().toISOString() })
    } catch (error) {
      res.status(500).json({ status: false, error: error.message || "Internal Server Error" })
    }
  })

  // POST endpoint
  app.post("/search/pinterest", createApiKeyMiddleware(), async (req, res) => {
    try {
      const { q } = req.body
      if (!q) return res.status(400).json({ status: false, error: "Query parameter is required" })

      const result = await pinterestSearch.search({ query: q.trim() })
      if (!result.status) {
        return res.status(result.code).json({ status: false, error: result.result.message })
      }

      res.status(200).json({ status: true, data: result.result, timestamp: new Date().toISOString() })
    } catch (error) {
      res.status(500).json({ status: false, error: error.message || "Internal Server Error" })
    }
  })
      }
