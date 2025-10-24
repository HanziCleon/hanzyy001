import axios from "axios";
import { cacheMiddleware } from "../server.js";

// Endpoint metadata
const endpoint = {
  name: "Random Blue Archive",
  path: "/random/ba",
  method: "GET",
  description: "Get random Blue Archive character images",
  category: "Random Images",
  responseBinary: true,
  params: [],
  
  // Handler function
  handler: [
    cacheMiddleware(30000), // Cache for 30 seconds
    async (req, res) => {
      try {
        // Fetch image list
        const { data } = await axios.get(
          "https://raw.githubusercontent.com/rynxzyy/blue-archive-r-img/refs/heads/main/links.json",
          { timeout: 10000 }
        );
        
        // Validate data
        if (!Array.isArray(data) || data.length === 0) {
          return res.status(500).json({
            success: false,
            error: "Failed to fetch image list"
          });
        }
        
        // Get random image URL
        const imgUrl = data[Math.floor(Math.random() * data.length)];
        
        // Fetch image
        const imgRes = await axios.get(imgUrl, { 
          responseType: "arraybuffer",
          timeout: 15000
        });
        
        // Send image
        res.setHeader("Content-Type", "image/jpeg");
        res.setHeader("Cache-Control", "public, max-age=3600");
        res.end(Buffer.from(imgRes.data));
        
      } catch (error) {
        console.error("Random BA Error:", error.message);
        res.status(500).json({
          success: false,
          error: "Failed to fetch random image",
          details: error.message
        });
      }
    }
  ]
};

export default endpoint;

