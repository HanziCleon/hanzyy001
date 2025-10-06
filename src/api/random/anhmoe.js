import axios from "axios"
import * as cheerio from "cheerio"
import { createApiKeyMiddleware } from "../../middleware/apikey.js"

class AnhMoe {
  #baseURL = "https://anh.moe"
  #headers = {
    Origin: "https://anh.moe",
    Referer: "https://anh.moe/",
    "User-Agent": "Dongtube-API/5.3.0",
  }

  #validCategories = [
    "sfw",
    "nsfw",
    "video-gore",
    "video-nsfw",
    "moe",
    "ai-picture",
    "hentai",
  ]

  async getRandom(category) {
    if (!this.#validCategories.includes(category)) {
      throw new Error(`Invalid category: ${category}. Valid options: ${this.#validCategories.join(", ")}`)
    }

    const { data } = await axios.get(`${this.#baseURL}/category/${category}`, {
      headers: this.#headers,
    })
    const $ = cheerio.load(data)
    const items = []

    $(".list-item").each((_, el) => {
      const $el = $(el)
      let dataObj = {}
      const raw = $el.attr("data-object")
      if (raw) {
        try {
          dataObj = JSON.parse(decodeURIComponent(raw))
        } catch {
          // ignore parse errors
        }
      }

      const title = $el.find(".list-item-desc-title a").attr("title") || dataObj.title
      const viewLink = new URL($el.find(".list-item-image a").attr("href"), this.#baseURL).href
      const uploader = $el.find(".list-item-desc-title div").text().trim()

      items.push({
        title,
        uploader,
        viewLink,
        type: dataObj.type,
        metadata: {
          ...dataObj.image,
          width: dataObj.width,
          height: dataObj.height,
          size: dataObj.size_formatted,
          uploaded: dataObj.how_long_ago,
        },
      })
    })

    if (items.length === 0) throw new Error("No items found in this category")

    const random = items[Math.floor(Math.random() * items.length)]
    return random
  }
}

const anh = new AnhMoe()

export default (app) => {
  app.all("/random/anhmoe", createApiKeyMiddleware(), async (req, res) => {
    try {
      const { category } = req.query.category ? req.query : req.body
      if (!category)
        return res.status(400).json({
          status: false,
          code: 400,
          result: { message: "Missing 'category' parameter" },
        })

      const data = await anh.getRandom(category)
      res.status(200).json({ status: true, code: 200, result: data })
    } catch (err) {
      res.status(500).json({
        status: false,
        code: 500,
        result: { message: err.message },
      })
    }
  })
}
