import ytSearch from "yt-search";
import { validate } from "../server.js";

// Endpoint metadata
const endpoint = {
  name: "YouTube Search",
  path: "/api/youtube/search",
  method: "POST",
  description: "Search YouTube videos by keyword",
  category: "Search Engines",
  params: [
    {
      name: "query",
      type: "text",
      required: true,
      placeholder: "nodejs tutorial",
      description: "Search query for YouTube videos"
    }
  ],
  
  // Handler function
  handler: async (req, res) => {
    try {
      const { query } = req.body;
      
      // Validation
      if (!validate.notEmpty(query)) {
        return res.status(400).json({
          success: false,
          error: "Query is required",
          example: { query: "nodejs tutorial" }
        });
      }
      
      // Search YouTube
      const results = await ytSearch(query);
      
      // Validate results
      if (!results || !results.videos) {
        return res.status(500).json({
          success: false,
          error: "Failed to search YouTube",
          message: "No results returned from YouTube"
        });
      }
      
      // Format videos
      const videos = results.videos.slice(0, 10).map(v => ({
        id: v.videoId,
        title: v.title,
        url: v.url,
        thumbnail: v.thumbnail,
        duration: v.timestamp,
        views: v.views,
        channel: v.author.name,
        uploadDate: v.ago
      }));
      
      // Send response
      res.json({
        success: true,
        query: query,
        count: videos.length,
        data: videos
      });
      
    } catch (error) {
      console.error("YouTube Search Error:", error.message);
      res.status(500).json({
        success: false,
        error: "Failed to search YouTube",
        details: error.message
      });
    }
  }
};

export default endpoint;

