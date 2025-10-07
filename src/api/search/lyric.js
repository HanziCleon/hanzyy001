import axios from "axios"
import { createApiKeyMiddleware } from "../../middleware/apikey.js"

async function searchLyrics(title) {
  if (!title) throw new Error("Title is required")

  const { data } = await axios.get(`https://lrclib.net/api/search?q=${encodeURIComponent(title)}`, {
    headers: {
      referer: `https://lrclib.net/search/${encodeURIComponent(title)}`,
      "user-agent": "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Mobile Safari/537.36",
    },
  })

  return data
}

export default (app) => {
  app.all("/search/lyrics", createApiKeyMiddleware(), async (req, res) => {
    try {
      const { q } = req.query.q ? req.query : req.body
      if (!q)
        return res.status(400).json({ status: false, code: 400, result: { message: "Missing 'q' parameter" } })

      const data = await searchLyrics(q)
      res.status(200).json({ status: true, code: 200, result: data })
    } catch (err) {
      res.status(500).json({ status: false, code: 500, result: { message: err.message } })
    }
  })
}
