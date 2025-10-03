// downloader/xiaohongshu.js
import axios from "axios"
import { createApiKeyMiddleware } from "../../middleware/apikey.js"

class Xiaohongshu {
  constructor() {
    this.api = "https://rednote-downloader.io/api/download"
  }

  async download({ url }) {
    if (!url) {
      return { status: false, code: 400, result: { message: "Xiaohongshu URL required" } }
    }

    try {
      const { data } = await axios.post(this.api, { url }, {
        headers: {
          "Content-Type": "application/json",
          "User-Agent": "Mozilla/5.0",
          "Referer": "https://rednote-downloader.io/"
        }
      })

      if (!data || !data.success) {
        return { status: false, code: 404, result: { message: "No media found" } }
      }

      return {
        status: true,
        code: 200,
        result: {
          title: data.title || null,
          author: data.author || null,
          thumbnail: data.cover || null,
          original_url: url,
          media_urls: data.medias?.map(m => ({
            type: m.type,
            quality: m.quality || "unknown",
            url: m.url,
            ext: m.ext || null
          })) || []
        }
      }
    } catch (err) {
      return { status: false, code: 500, result: { message: err.message } }
    }
  }
}

const xhs = new Xiaohongshu()

export default (app) => {
  app.get("/downloader/xiaohongshu", createApiKeyMiddleware(), async (req, res) => {
    const { url } = req.query
    const result = await xhs.download({ url })
    res.status(result.code).json(result)
  })
}
