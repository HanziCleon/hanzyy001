import axios from "axios";
import FormData from "form-data";
import { validate } from "../server.js";

const endpoint = {
  name: "Image Enhancer",
  path: "/api/enhance/image",
  method: "POST",
  description: "Enhance and upscale image quality using AI",
  category: "Image Processing",
  responseBinary: true,
  params: [
    {
      name: "url",
      type: "text",
      required: true,
      placeholder: "https://example.com/image.jpg",
      description: "Image URL to enhance"
    }
  ],
  
  handler: async (req, res) => {
    try {
      const { url } = req.body;
      
      if (!validate.url(url)) {
        return res.status(400).json({
          success: false,
          error: "Invalid image URL"
        });
      }
      
      const imgResponse = await axios.get(url, { 
        responseType: "arraybuffer",
        timeout: 30000
      });
      
      const buffer = Buffer.from(imgResponse.data, "binary");
      const form = new FormData();
      form.append("method", "1");
      form.append("is_pro_version", "false");
      form.append("is_enhancing_more", "false");
      form.append("max_image_size", "high");
      form.append("file", buffer, `image_${Date.now()}.jpg`);
      
      const { data } = await axios.post("https://ihancer.com/api/enhance", form, {
        headers: { 
          ...form.getHeaders(), 
          "user-agent": "Mozilla/5.0" 
        },
        responseType: "arraybuffer",
        timeout: 60000
      });
      
      res.setHeader("Content-Type", "image/jpeg");
      res.setHeader("Cache-Control", "public, max-age=86400");
      res.end(Buffer.from(data));
      
    } catch (error) {
      console.error("Enhance Image Error:", error.message);
      res.status(500).json({
        success: false,
        error: "Failed to enhance image",
        details: error.message
      });
    }
  }
};

export default endpoint;
