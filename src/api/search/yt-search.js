import ytSearch from "yt-search"
import { createApiKeyMiddleware } from "../../middleware/apikey.js"

class YouTubeSearch {
  async search({ query, limit = 10 }) {
    if (!query) {
      return {
        status: false,
        code: 400,
        result: { message: "Query parameter is required" },
      }
    }

    try {
      const result = await ytSearch(query)
      if (!result || !result.videos || result.videos.length === 0) {
        return {
          status: false,
          code: 404,
          result: { message: "No results found" },
        }
      }

      const videos = result.videos.slice(0, limit).map((video) => ({
        title: video.title,
        description: video.description,
        url: video.url,
        duration: video.timestamp,
        views: video.views,
        ago: video.ago,
        author: video.author?.name || "",
        thumbnail: video.thumbnail,
      }))

      return {
        status: true,
        code: 200,
        result: {
          query,
          count: videos.length,
          videos,
        },
      }
    } catch (error) {
      return {
        status: false,
        code: 500,
        result: { message: "YouTube search failed" },
      }
    }
  }
}

const youtubeSearch = new YouTubeSearch()

export default (app) => {
  // GET endpoint
  app.get("/search/youtube", createApiKeyMiddleware(), async (req, res) => {
    try {
      const { q, limit } = req.query
      const result = await youtubeSearch.search({ query: q, limit: parseInt(limit) || 10 })
      res.status(result.code).json(result)
    } catch (error) {
      res.status(500).json({ status: false, error: "Internal Server Error" })
    }
  })

  // POST endpoint
  app.post("/search/youtube", createApiKeyMiddleware(), async (req, res) => {
    try {
      const { query, limit } = req.body
      const result = await youtubeSearch.search({ query, limit: parseInt(limit) || 10 })
      res.status(result.code).json(result)
    } catch (error) {
      res.status(500).json({ status: false, error: "Internal Server Error" })
    }
  })
}
