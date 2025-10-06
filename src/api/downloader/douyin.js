// douyin-downloader.js
import axios from "axios"
import * as cheerio from "cheerio"
import qs from "qs"
import { createApiKeyMiddleware } from "../../middleware/apikey.js"

class DouyinDownloader {
  constructor() {
    this.endpoint = "https://savetik.co/api/ajaxSearch"
  }

  async download({ url }) {
    if (!url) {
      return {
        status: false,
        code: 400,
        result: { message: "Parameter 'url' Douyin diperlukan." }
      }
    }

    try {
      const postData = qs.stringify({
        q: url,
        lang: "id",
        cftoken: ""
      })

      const headers = {
        "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
        "Accept": "*/*",
        "X-Requested-With": "XMLHttpRequest",
        "User-Agent": "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Mobile Safari/537.36",
        "Referer": "https://savetik.co/id/douyin-downloader"
      }

      const res = await axios.post(this.endpoint, postData, { headers })

      // parsing HTML response
      const $ = cheerio.load(res.data.data)
      const caption = $("h3").text().trim()
      const thumbnail = $("img").attr("src") || ""
      const video = $('a:contains("Unduh MP4")').attr("href") || ""
      const video_hd = $('a:contains("Unduh MP4 HD")').attr("href") || ""
      const audio = $('a:contains("Unduh MP3")').attr("href") || ""

      const media = []
      if (video) media.push({ type: "video", quality: "SD", url: video, thumbnail })
      if (video_hd) media.push({ type: "video", quality: "HD", url: video_hd, thumbnail })
      if (audio) media.push({ type: "audio", quality: "MP3", url: audio })

      return {
        status: true,
        code: 200,
        result: {
          caption,
          thumbnail,
          original_url: url,
          media
        }
      }
    } catch (err) {
      return {
        status: false,
        code: 500,
        result: { message: err.message || "Gagal memproses Douyin downloader." }
      }
    }
  }
}

const douyin = new DouyinDownloader()

export default (app) => {
  app.get("/api/d/douyin", createApiKeyMiddleware(), async (req, res) => {
    const { url } = req.query
    const result = await douyin.download({ url })
    res.status(result.code).json(result)
  })

  app.post("/api/d/douyin", createApiKeyMiddleware(), async (req, res) => {
    const { url } = req.body
    const result = await douyin.download({ url })
    res.status(result.code).json(result)
  })
}
