import axios from "axios"
import * as cheerio from "cheerio"
import { createApiKeyMiddleware } from "../../middleware/apikey.js"

class ATL {
  parseImg(url) {
    try {
      const urlObj = new URL(url)
      const params = new URLSearchParams(urlObj.search)
      return params.get("url") || url
    } catch {
      return url
    }
  }

  async search(query) {
    if (!query) throw new Error("Query is required")

    const { data } = await axios.get(`https://asiantolick.com/search/${encodeURIComponent(query)}`)
    const $ = cheerio.load(data)
    const results = []

    $("div#container a.miniatura").each((_, el) => {
      const title = $(el).find("span.titulo_video").text().trim()
      const total_images = $(el).find("div.contar_imagens").text().trim()
      const cover = $(el).find("img").attr("data-src")
      const url = $(el).attr("href")

      if (title && cover && url) {
        results.push({
          title,
          total_images,
          cover: this.parseImg(cover),
          url,
        })
      }
    })

    return results
  }

  async detail(url) {
    if (!url || !url.includes("asiantolick.com")) throw new Error("Invalid URL")

    const { data } = await axios.get(url)
    const $ = cheerio.load(data)
    const post = $("#post_content article")

    const title = post.find("h1").text().trim() || null
    const thumbs_up = post.find("#postlike_content #postlike_count").text().trim() || null
    const upload_date = post.find("#metadata_qrcode span").eq(1).text().split(":")[1]?.trim() || null
    const total_pics = post.find("#metadata_qrcode span").eq(2).text().split(":")[1]?.trim() || null
    const pic_size = post.find("#metadata_qrcode span").eq(3).text().split(":")[1]?.trim() || null
    const album_size = post.find("#metadata_qrcode span").eq(4).text().split(":")[1]?.trim() || null
    const category = post.find('#categoria_tags_post a[href*="category"]').text().trim() || null
    const download_url = post.find("a#download_post").attr("href") || null

    const tags = []
    post.find('#categoria_tags_post a[href*="tag"]').each((_, tag) => {
      const t = $(tag).text().trim()
      if (t) tags.push(t)
    })

    const pics = []
    post.find(".spotlight-group div").each((_, img) => {
      const src = $(img).find("img").attr("src")
      if (src) pics.push(this.parseImg(src))
    })

    return {
      title,
      thumbs_up,
      upload_date,
      total_pics,
      pic_size,
      album_size,
      category,
      tags,
      pics,
      download_url,
    }
  }

  async searchWithDetails(query, limit = 5) {
    const results = await this.search(query)
    const sliced = results.slice(0, limit)

    const detailed = await Promise.all(
      sliced.map(async (item) => {
        try {
          const details = await this.detail(item.url)
          return { ...item, ...details }
        } catch (err) {
          return { ...item, error: err.message }
        }
      })
    )

    return detailed
  }
}

const atl = new ATL()

export default (app) => {
  app.all("/search/atl", createApiKeyMiddleware(), async (req, res) => {
    try {
      const { q, limit } = req.query.q ? req.query : req.body
      if (!q)
        return res
          .status(400)
          .json({ status: false, code: 400, result: { message: "Missing 'q' parameter" } })

      const data = await atl.searchWithDetails(q, parseInt(limit) || 5)

      res.status(200).json({
        status: true,
        code: 200,
        result: {
          query: q,
          count: data.length,
          albums: data,
        },
      })
    } catch (err) {
      res.status(500).json({
        status: false,
        code: 500,
        result: { message: err.message },
      })
    }
  })
}
