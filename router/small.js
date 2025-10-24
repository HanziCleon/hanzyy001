import axios from "axios";
import * as cheerio from "cheerio";
import { validate } from "../server.js";

// Endpoint metadata
const endpoint = {
  name: "MAL Search",
  path: "/api/mal/search",
  method: "POST",
  description: "Search anime or manga on MyAnimeList",
  category: "Anime & Manga",
  params: [
    {
      name: "query",
      type: "text",
      required: true,
      placeholder: "naruto",
      description: "Search query for anime or manga"
    },
    {
      name: "type",
      type: "select",
      required: false,
      description: "Type of content to search",
      options: [
        { value: "anime", label: "Anime" },
        { value: "manga", label: "Manga" }
      ]
    }
  ],
  
  // Handler function
  handler: async (req, res) => {
    try {
      const { query, type = "anime" } = req.body;
      
      // Validation
      if (!validate.notEmpty(query)) {
        return res.status(400).json({
          success: false,
          error: "Query is required",
          example: { query: "naruto", type: "anime" }
        });
      }
      
      if (!["anime", "manga"].includes(type)) {
        return res.status(400).json({
          success: false,
          error: "Type must be anime or manga"
        });
      }
      
      // Fetch search results
      const { data: html } = await axios.get(
        `https://myanimelist.net/${type}.php`,
        {
          params: { q: query, cat: type },
          timeout: 15000,
          headers: {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
          }
        }
      );
      
      // Parse HTML
      const $ = cheerio.load(html);
      const list = [];
      
      $("table tbody tr").each((i, el) => {
        if (i >= 20) return false;
        const $el = $(el);
        const title = $el.find("td:nth-child(2) strong").text().trim();
        const url = $el.find("td:nth-child(2) a").attr("href");
        
        if (title && url) {
          list.push({
            title,
            url,
            cover: $el.find("td:nth-child(1) img").attr("data-src") || 
                   $el.find("td:nth-child(1) img").attr("src"),
            type: $el.find("td:nth-child(3)").text().trim(),
            score: $el.find("td:nth-child(5)").text().trim(),
            description: $el.find("td:nth-child(2) .pt4")
              .text()
              .replace("read more.", "")
              .trim() || "No description"
          });
        }
      });
      
      // Send response
      res.json({
        success: true,
        query: query,
        type: type,
        count: list.length,
        data: list
      });
      
    } catch (error) {
      console.error("MAL Search Error:", error.message);
      
      if (error.response?.status === 429) {
        return res.status(429).json({
          success: false,
          error: "Rate limited by MyAnimeList",
          message: "Too many requests. Please try again later."
        });
      }
      
      res.status(500).json({
        success: false,
        error: "Failed to search MyAnimeList",
        details: error.message
      });
    }
  }
};

export default endpoint;

