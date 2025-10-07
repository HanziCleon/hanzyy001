// downloader-tiktok.js
import axios from "axios"
import { createApiKeyMiddleware } from "../../middleware/apikey.js"

class TikTok {
  constructor() {
    this.base = "https://www.tikwm.com/api/"
    this.client = axios.create({
      baseURL: this.base,
      headers: {
        "user-agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36",
        accept: "application/json, text/plain, */*",
      }
    })
  }

  async download({ url }) {
    if (!url) {
      return {
        status: false,
        code: 400,
        result: { message: "Invalid TikTok URL" }
      }
    }

    try {
      const { data } = await this.client.get(`?url=${encodeURIComponent(url)}`)
      if (!data || !data.data) {
        return {
          status: false,
          code: 404,
          result: { message: "Video not found" }
        }
      }

      const video = data.data
      const mediaUrls = []

      // video no watermark
      if (video.play) {
        mediaUrls.push({
          type: "video",
          quality: "hd",
          url: video.play,
          thumbnail: video.cover
        })
      }

      // video with watermark
      if (video.wmplay) {
        mediaUrls.push({
          type: "video",
          quality: "watermark",
          url: video.wmplay,
          thumbnail: video.cover
        })
      }

      return {
        status: true,
        code: 200,
        result: {
          id: video.id,
          title: video.title || "",
          description: video.title || "",
          original_url: url,
          final_url: video.play,
          author: {
            username: video.author?.unique_id,
            nickname: video.author?.nickname,
            avatar: video.author?.avatar
          },
          media_urls: mediaUrls
        }
      }
    } catch (err) {
      return {
        status: false,
        code: 500,
        result: { message: err.message || "Server error" }
      }
    }
  }
}

const tiktok = new TikTok()

export default (app) => {
  app.get("/api/d/tiktok", createApiKeyMiddleware(), async (req, res) => {
    const { url } = req.query
    const result = await tiktok.download({ url })
    res.status(result.code).json(result)
  })

  app.post("/api/d/tiktok", createApiKeyMiddleware(), async (req, res) => {
    const { url } = req.body
    const result = await tiktok.download({ url })
    res.status(result.code).json(result)
  })
}
