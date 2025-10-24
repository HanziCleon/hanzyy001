import axios from "axios";
import { validate } from "../server.js";

// Endpoint metadata
const endpoint = {
  name: "TikTok Download",
  path: "/api/d/tiktok",
  method: "GET",
  description: "Download TikTok videos without watermark",
  category: "Social Media Downloads",
  params: [
    {
      name: "url",
      type: "text",
      required: true,
      placeholder: "https://www.tiktok.com/@user/video/123",
      description: "TikTok video URL"
    }
  ],
  
  // Handler function
  handler: async (req, res) => {
    try {
      const { url } = req.query;
      
      // Validation
      if (!validate.url(url, "tiktok.com")) {
        return res.status(400).json({
          success: false,
          error: "Invalid TikTok URL",
          example: "https://www.tiktok.com/@user/video/123456789"
        });
      }
      
      // Fetch video data
      const { data } = await axios.get("https://www.tikwm.com/api/", {
        params: { url },
        timeout: 30000
      });
      
      // Validate response
      if (!data?.data) {
        return res.status(500).json({
          success: false,
          error: "Failed to fetch TikTok data",
          message: "The video might be private or unavailable"
        });
      }
      
      // Send response
      res.json({
        success: true,
        data: data.data
      });
      
    } catch (error) {
      console.error("TikTok Download Error:", error.message);
      
      // Handle specific errors
      if (error.code === "ECONNABORTED") {
        return res.status(408).json({
          success: false,
          error: "Request timeout",
          message: "The request took too long. Please try again."
        });
      }
      
      res.status(500).json({
        success: false,
        error: "Failed to download TikTok video",
        details: error.message
      });
    }
  }
};

export default endpoint;

