// downloader-threads.js
import axios from "axios"
import { shannz as cf } from "bycf"
import { createApiKeyMiddleware } from "../../middleware/apikey.js"

class ThreadsDownloader {
  async fetch(url) {
    let id
    try {
      const urlObj = new URL(url)
      const pathParts = urlObj.pathname.split("/")
      id = pathParts[pathParts.length - 1]

      if (!id) throw new Error("ID tidak ada di URL")
    } catch {
      return { status: false, code: 400, result: { message: "URL tidak valid" } }
    }

    try {
      const token = await cf.turnstileMin(
        "https://threadsdownloader.com",
        "0x4AAAAAAAcllMeG_B7qyNXJ",
        null
      )

      const config = {
        method: "GET",
        url: `https://api.twitterpicker.com/threads/post/media?id=${id}&cap=tcaptcha-${token}`,
        headers: {
          "User-Agent": "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Mobile Safari/537.36",
          "origin": "https://threadsdownloader.com"
        }
      }

      const { data } = await axios.request(config)
      return { status: true, code: 200, result: data }
    } catch (e) {
      return { status: false, code: 500, result: { message: e.message } }
    }
  }
}

const threads = new ThreadsDownloader()

export default (app) => {
  app.get("/downloader/threads", createApiKeyMiddleware(), async (req, res) => {
    const { url } = req.query
    if (!url) return res.status(400).json({ status: false, error: "URL parameter required" })

    const result = await threads.fetch(url)
    res.status(result.code).json(result)
  })
}
