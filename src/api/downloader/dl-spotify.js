// downloader-spotify.js
import axios from "axios"
import qs from "querystring"
import { createApiKeyMiddleware } from "../../middleware/apikey.js"

class SpotifyDownloader {
  async fetch(url) {
    try {
      const payload = qs.stringify({
        action: "spotify_downloader_get_info",
        url,
        nonce: "4658c378c7"
      })

      const res = await axios.post(
        "https://spotify.downloaderize.com/wp-admin/admin-ajax.php",
        payload,
        {
          headers: {
            "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
            "X-Requested-With": "XMLHttpRequest"
          }
        }
      )

      const data = res.data
      if (!data.success || !data.data?.medias?.length) {
        return { status: false, code: 404, result: { message: "Gagal scrape data" } }
      }

      const song = data.data
      const media = song.medias[0]

      return {
        status: true,
        code: 200,
        result: {
          title: song.title,
          artist: song.author,
          duration: song.duration,
          cover: song.thumbnail,
          download_url: media.url,
          quality: media.quality,
          ext: media.extension
        }
      }
    } catch (e) {
      return { status: false, code: 500, result: { message: e.message } }
    }
  }
}

const spotify = new SpotifyDownloader()

export default (app) => {
  app.get("/downloader/spotify", createApiKeyMiddleware(), async (req, res) => {
    const { url } = req.query
    if (!url) return res.status(400).json({ status: false, error: "URL parameter required" })

    const result = await spotify.fetch(url)
    res.status(result.code).json(result)
  })
}
