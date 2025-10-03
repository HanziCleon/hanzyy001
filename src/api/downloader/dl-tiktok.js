import axios from "axios"
import * as cheerio from "cheerio"
import { createApiKeyMiddleware } from "../../middleware/apikey.js"

class TikTok {
  constructor() {
    this.headers = {
      authority: "ttsave.app",
      accept: "application/json, text/plain, */*",
      origin: "https://ttsave.app",
      referer: "https://ttsave.app/en",
      "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/132.0.0.0 Safari/537.36",
    }
    this.client = axios.create({
      baseURL: "https://ttsave.app",
      headers: this.headers,
    })
  }

  async submit(url, referer = "https://ttsave.app/en") {
    const data = { query: url, language_id: "1" }
    return this.client.post("/download", data, {
      headers: { ...this.headers, referer },
    })
  }

  parse($) {
    const nickname = $("h2.font-extrabold").text()
    const username = $("a.font-extrabold.text-blue-400").text()
    const description = $("p.text-gray-600").text()

    const dlink = {
      nowm: $("a.w-full.text-white.font-bold").first().attr("href"),
      wm: $("a.w-full.text-white.font-bold").eq(1).attr("href"),
      audio: $("a[type='audio']").attr("href"),
      cover: $("a[type='cover']").attr("href"),
    }

    const slides = $("a[type='slide']")
      .map((i, el) => ({
        number: i + 1,
        url: $(el).attr("href"),
      }))
      .get()

    return {
      nickname,
      username,
      description,
      dlink,
      slides,
    }
  }

  async download({ url }) {
    if (!url) {
      return { status: false, code: 400, result: { message: "URL parameter is required" } }
    }

    try {
      const response = await this.submit(url)
      const $ = cheerio.load(response.data)
      const parsed = this.parse($)

      if (parsed.slides && parsed.slides.length > 0) {
        return {
          status: true,
          code: 200,
          result: {
            type: "slide",
            ...parsed,
          },
        }
      }

      return {
        status: true,
        code: 200,
        result: {
          type: "video",
          ...parsed,
          videoInfo: {
            nowm: parsed.dlink.nowm,
            wm: parsed.dlink.wm,
          },
        },
      }
    } catch (error) {
      return {
        status: false,
        code: 500,
        result: { message: "Failed to fetch TikTok video" },
      }
    }
  }
}

const tiktok = new TikTok()

export default (app) => {
  // GET endpoint
  app.get("/downloader/tiktok", createApiKeyMiddleware(), async (req, res) => {
    try {
      const { url } = req.query
      const result = await tiktok.download({ url })
      res.status(result.code).json(result)
    } catch (error) {
      res.status(500).json({ status: false, error: "Internal Server Error" })
    }
  })

  // POST endpoint
  app.post("/downloader/tiktok", createApiKeyMiddleware(), async (req, res) => {
    try {
      const { url } = req.body
      const result = await tiktok.download({ url })
      res.status(result.code).json(result)
    } catch (error) {
      res.status(500).json({ status: false, error: "Internal Server Error" })
    }
  })
}
