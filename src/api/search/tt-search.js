import axios from "axios";
import { createApiKeyMiddleware } from "../../middleware/apikey.js";

class TikTokSearch {
  async search(query, count = 15) {
    if (!query) {
      return {
        status: false,
        code: 400,
        result: { message: "Query is required" },
      };
    }
    try {
      const json = { keywords: query, count, cursor: 0, web: 1, hd: 1 };
      const { data } = await axios.post(
        "https://tikwm.com/api/feed/search",
        json,
        {
          headers: {
            "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
            Accept: "application/json, text/javascript, */*; q=0.01",
            "X-Requested-With": "XMLHttpRequest",
          },
        }
      );

      if (!data || !data.data || !data.data.videos.length)
        return {
          status: false,
          code: 404,
          result: { message: "No videos found" },
        };

      return {
        status: true,
        code: 200,
        result: data.data.videos.map((video) => ({
          id: video.id,
          title: video.title,
          author: {
            name: video.author.nickname,
            username: video.author.unique_id,
          },
          stats: {
            play_count: video.play_count,
            like_count: video.digg_count,
            comment_count: video.comment_count,
            share_count: video.share_count,
          },
          music: video.music_info,
          media: {
            no_watermark: "https://tikwm.com" + video.play,
            watermark: "https://tikwm.com" + video.wmplay,
            music: "https://tikwm.com" + video.music,
            cover: "https://tikwm.com" + video.cover,
          },
        })),
      };
    } catch (error) {
      return {
        status: false,
        code: 500,
        result: { message: error.message || "Internal server error" },
      };
    }
  }
}

const tiktokSearch = new TikTokSearch();

export default (app) => {
  app.get("/search/tiktok", createApiKeyMiddleware(), async (req, res) => {
    const { q, count } = req.query;
    const result = await tiktokSearch.search(q, parseInt(count) || 15);
    res.status(result.code).json(result);
  });

  app.post("/search/tiktok", createApiKeyMiddleware(), async (req, res) => {
    const { query, count } = req.body;
    const result = await tiktokSearch.search(query, parseInt(count) || 15);
    res.status(result.code).json(result);
  });
};