import axios from "axios"
import * as cheerio from "cheerio"
import { createApiKeyMiddleware } from "../../middleware/apikey.js"

class Cookpad {
  async searchWithDetails(query, limit = 5) {
    if (!query) throw new Error("Query is required")

    // 🔎 1. Cari hasil dari Cookpad
    const { data } = await axios.get(`https://cookpad.com/id/cari/${encodeURIComponent(query)}`)
    const $ = cheerio.load(data)
    const recipes = []

    $('li[id^="recipe_"]').each((i, el) => {
      if (i >= limit) return false // batasi agar tidak terlalu berat
      const recipeId = $(el).attr("id").replace("recipe_", "")
      const title = $(el).find("a.block-link__main").text().trim()
      const url = `https://cookpad.com/id/resep/${recipeId}`
      const thumb = $(el).find('picture img[fetchpriority="auto"]').attr("src")
      const author = $(el).find(".flex.items-center.mt-auto span.text-cookpad-gray-600").text().trim()
      recipes.push({ id: recipeId, title, url, thumb, author })
    })

    // 📖 2. Ambil detail tiap resep secara paralel (max 5)
    const detailedResults = await Promise.all(
      recipes.map(async (r) => {
        try {
          const detail = await this.getDetail(r.url)
          return { ...r, ...detail }
        } catch (err) {
          return { ...r, error: err.message }
        }
      })
    )

    return detailedResults
  }

  async getDetail(url) {
    if (!url.includes("cookpad.com")) throw new Error("Invalid Cookpad URL")

    const { data } = await axios.get(url)
    const $ = cheerio.load(data)

    const ldJson = $('script[type="application/ld+json"]')
      .toArray()
      .map((el) => {
        try {
          return JSON.parse($(el).text())
        } catch {
          return null
        }
      })
      .filter((j) => j && j["@type"] === "Recipe")

    if (ldJson.length === 0) throw new Error("Recipe detail not found")
    const recipe = ldJson[0]

    return {
      title: recipe.name || $("h1.break-words").text().trim(),
      description: recipe.description || $("meta[name='description']").attr("content"),
      imageUrl: recipe.image || $("meta[property='og:image']").attr("content"),
      author: recipe.author?.name || null,
      servings: recipe.recipeYield || null,
      prepTime: $("div[id*='cooking_time_recipe_'] span.mise-icon-text").first().text().trim() || null,
      ingredients: recipe.recipeIngredient || [],
      steps: (recipe.recipeInstructions || []).map((s) => ({
        text: s.text,
        images: s.image || [],
      })),
      datePublished: recipe.datePublished,
      dateModified: recipe.dateModified,
    }
  }
}

const cookpad = new Cookpad()

export default (app) => {
  app.all("/search/cookpad", createApiKeyMiddleware(), async (req, res) => {
    try {
      const { q, limit } = req.query.q ? req.query : req.body
      if (!q)
        return res.status(400).json({ status: false, code: 400, result: { message: "Missing 'q' parameter" } })

      const recipes = await cookpad.searchWithDetails(q, parseInt(limit) || 5)

      res.status(200).json({
        status: true,
        code: 200,
        result: {
          query: q,
          count: recipes.length,
          recipes,
        },
      })
    } catch (err) {
      res.status(500).json({ status: false, code: 500, result: { message: err.message } })
    }
  })
}
