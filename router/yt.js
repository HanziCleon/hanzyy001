import axios from "axios";
import { validate } from "../server.js";

const endpoint = {
  name: "YouTube Download",
  path: "/api/youtube/download",
  method: "POST",
  description: "Download YouTube videos in various qualities",
  category: "Social Media Downloads",
  params: [
    {
      name: "url",
      type: "text",
      required: true,
      placeholder: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
      description: "YouTube video URL"
    }
  ],
  
  handler: async (req, res) => {
    try {
      const { url } = req.body;
      
      if (!validate.url(url) || (!url.includes("youtube.com") && !url.includes("youtu.be"))) {
        return res.status(400).json({
          success: false,
          error: "Invalid YouTube URL",
          example: "https://www.youtube.com/watch?v=dQw4w9WgXcQ"
        });
      }
      
      const apiUrl = `https://www.a2zconverter.com/api/files/new-proxy?url=${encodeURIComponent(url)}`;
      const { data } = await axios.get(apiUrl, {
        headers: {
          "Referer": "https://www.a2zconverter.com/youtube-video-downloader",
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
        },
        timeout: 30000
      });
      
      res.json({ success: true, data });
      
    } catch (error) {
      console.error("YouTube Download Error:", error.message);
      res.status(500).json({
        success: false,
        error: "Failed to download YouTube video",
        details: error.message
      });
    }
  }
};

export default endpoint;

