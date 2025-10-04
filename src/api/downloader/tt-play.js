import axios from "axios";
import cheerio from "cheerio";
import { createApiKeyMiddleware } from "../../middleware/apikey.js";

class TikTokPlay {
  constructor() {
    this.apiUrl = "https://tiktokio.com/api/v1/tk-htmx";
  }

  async getVideoDetails(url) {
    if (!url) {
      return { status: false, code: 400, result: { message: "URL is required" } };
    }

    try {
      const data = new URLSearchParams({
        prefix: "dtGslxrcdcG9raW8uY29t",
        vid: url,
      });

      const config = {
        headers: {
          "HX-Request": "true",
          "HX-Trigger": "search-btn",
          "HX-Target": "tiktok-parse-result",
          "HX-Current-URL": "https://tiktokio.com/id/",
          "Content-Type": "application/x-www-form-urlencoded",
        },
      };

      const response = await axios.post(this.apiUrl, data, config);
      const $ = cheerio.load(response.data);

      const mediaUrls = {};
      const slides = [];

      $(".download-item img").each((_, el) => {
        const src = $(el).attr("src");
        if (src) slides.push(src);
      });

      if (slides.length > 0) {
        mediaUrls.slides = slides;
      }

      $("div.tk-down-link").each((_, el) => {
        const linkType = $(el).find("a").text().trim();
        const href = $(el).find("a").attr("href");

        if (linkType === "Download watermark") mediaUrls.watermark = href;
        else if (linkType === "Download Mp3") mediaUrls.mp3 = href;
        else if (linkType === "Download without watermark") mediaUrls.no_watermark = href;
        else if (linkType === "Download without watermark (HD)") mediaUrls.hd = href;
      });

      return {
        status: true,
        code: 200,
        result: {
          title: $("h2").text(),
          media: mediaUrls,
        },
      };
    } catch (error) {
      return {
        status: false,
        code: 500,
        result: { message: error.message || "Failed to fetch video details" },
      };
    }
  }
}

const tiktokPlay = new TikTokPlay();

export default (app) => {
  app.get("/play/tiktok", createApiKeyMiddleware(), async (req, res) => {
    const { url } = req.query;
    if (!url) return res.status(400).json({ status: false, message: "URL parameter is required" });

    const result = await tiktokPlay.getVideoDetails(url);
    res.status(result.code).json(result);
  });

  app.post("/play/tiktok", createApiKeyMiddleware(), async (req, res) => {
    const { url } = req.body;
    if (!url) return res.status(400).json({ status: false, message: "URL parameter is required" });

    const result = await tiktokPlay.getVideoDetails(url);
    res.status(result.code).json(result);
  });
};