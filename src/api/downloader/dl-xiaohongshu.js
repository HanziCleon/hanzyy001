// downloader-xiaohongshu.js
import axios from "axios"
import { createApiKeyMiddleware } from "../../middleware/apikey.js"

class Xiaohongshu {
  constructor() {
    this.api = {
      base: "https://rednote-downloader.io",
      endpoint: "/api/download",
    }
    this.client = axios.create({
      baseURL: this.api.base,
      headers: {
        "Content-Type": "application/json",
        "User-Agent":
          "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Mobile Safari/537.36",
        Referer: "https://rednote-downloader.io/?ref=api",
      },
    })
  }

  isUrl(str) {
    try {
      new URL(str)
      return true
    } catch (_) {
      return false
    }
  }

  async download({ url }) {
    if (!url || !this.isUrl(url)) {
      return {
        status: false,
        code: 400,
        result: { message: "Invalid Xiaohongshu URL" },
      }
    }

    try {
      const { data } = await this.client.post(this.api.endpoint, { url })
      if (!data) {
        return {
          status: false,
          code: 404,
          result: { message: "No media found in this Xiaohongshu post" },
        }
      }

      return {
        status: true,
        code: 200,
        result: data, // langsung return JSON dari API
      }
    } catch (error) {
      return {
        status: false,
        code: error.response?.status || 500,
        result: {
          message: error.response?.data?.message || error.message || "Server error",
        },
      }
    }
  }
}

const xhs = new Xiaohongshu()

export default (app) => {
  // GET endpoint
  app.get("/downloader/xiaohongshu", createApiKeyMiddleware(), async (req, res) => {
    try {
      const { url } = req.query
      if (!url) {
        return res.status(400).json({ status: false, error: "URL parameter is required" })
      }

      const result = await xhs.download({ url: url.trim() })
      if (!result.status) {
        return res.status(result.code).json({ status: false, error: result.result.message })
      }

      res.status(200).json({
        status: true,
        data: result.result,
        timestamp: new Date().toISOString(),
      })
    } catch (error) {
      res.status(500).json({ status: false, error: error.message || "Internal Server Error" })
    }
  })

  // POST endpoint
  app.post("/downloader/xiaohongshu", createApiKeyMiddleware(), async (req, res) => {
    try {
      const { url } = req.body
      if (!url) {
        return res.status(400).json({ status: false, error: "URL parameter is required" })
      }

      const result = await xhs.download({ url: url.trim() })
      if (!result.status) {
        return res.status(result.code).json({ status: false, error: result.result.message })
      }

      res.status(200).json({
        status: true,
        data: result.result,
        timestamp: new Date().toISOString(),
      })
    } catch (error) {
      res.status(500).json({ status: false, error: error.message || "Internal Server Error" })
    }
  })
}
