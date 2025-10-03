// downloader-spotify.js
import axios from "axios"
import qs from "querystring"
import { createApiKeyMiddleware } from "../../middleware/apikey.js"

class Spotify {
  constructor() {
    this.base = "https://spotify.downloaderize.com/wp-admin/admin-ajax.php"
    this.client = axios.create({
      baseURL: this.base,
      headers: {
        "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
        "User-Agent": "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Mobile Safari/537.36",
        "X-Requested-With": "XMLHttpRequest",
        Accept: "application/json, text/javascript, */*; q=0.01"
      }
    })
  }

  async download({ url }) {
    if (!url) {
      return {
        status: false,
        code: 400,
        result: { message: "Spotify URL required" }
      }
    }

    try {
      const payload = qs.stringify({
        action: "spotify_downloader_get_info",
        url,
        nonce: "4658c378c7" // fixed token dari service
      })

      const { data } = await this.client.post("", payload)
      if (!data.success || !data.data?.medias?.length) {
        return {
          status: false,
          code: 404,
          result: { message: "Track not found or unsupported." }
        }
      }

      const song = data.data
      const mediaUrls = song.medias.map((m) => ({
        type: "audio",
        quality: m.quality,
        url: m.url,
        ext: m.extension
      }))

      return {
        status: true,
        code: 200,
        result: {
          id: song.id || null,
          title: song.title,
          artist: song.author,
          duration: song.duration,
          cover: song.thumbnail,
          original_url: url,
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

const spotify = new Spotify()

export default (app) => {
  app.get("/downloader/spotify", createApiKeyMiddleware(), async (req, res) => {
    const { url } = req.query
    const result = await spotify.download({ url })
    res.status(result.code).json(result)
  })

  app.post("/downloader/spotify", createApiKeyMiddleware(), async (req, res) => {
    const { url } = req.body
    const result = await spotify.download({ url })
    res.status(result.code).json(result)
  })
}
