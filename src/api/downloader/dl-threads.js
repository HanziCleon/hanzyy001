// downloader/threads.js
import axios from "axios"
import { createApiKeyMiddleware } from "../../middleware/apikey.js"

class Threads {
  constructor() {
    this.base = "https://www.threads.net"
  }

  async download({ url }) {
    if (!url) {
      return { status: false, code: 400, result: { message: "Threads URL required" } }
    }

    try {
      const { data } = await axios.get(`https://threadsdownloader.io/api?url=${encodeURIComponent(url)}`)
      if (!data || !data.media) {
        return { status: false, code: 404, result: { message: "No media found" } }
      }

      return {
        status: true,
        code: 200,
        result: {
          title: data.title || null,
          author: data.author || null,
          thumbnail: data.thumbnail || null,
          original_url: url,
          media_urls: data.media.map(m => ({
            type: m.type,
            quality: m.quality || "unknown",
            url: m.url,
            ext: m.ext || null
          }))
        }
      }
    } catch (e) {
      return { status: false, code: 500, result: { message: e.message } }
    }
  }
}

const threads = new Threads()

export default (app) => {
  app.get("/downloader/threads", createApiKeyMiddleware(), async (req, res) => {
    const { url } = req.query
    const result = await threads.download({ url })
    res.status(result.code).json(result)
  })
}
