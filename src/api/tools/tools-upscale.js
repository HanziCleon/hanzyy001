import axios from "axios";
import FormData from "form-data";
import { Buffer } from "buffer";
import { fileTypeFromBuffer } from "file-type";
import { createApiKeyMiddleware } from "../../middleware/apikey.js";
import multer from "multer";

// Gunakan memory storage untuk Vercel
const upload = multer({ 
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
  fileFilter: (req, file, cb) => {
    // Check if file is an image
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed!'), false);
    }
  }
});

class PicsArtUpscaler {
  constructor() {
    this.authToken = null;
    this.uploadUrl = "https://upload.picsart.com/files";
    this.enhanceUrl = "https://ai.picsart.com/gw1/diffbir-enhancement-service/v1.7.6";
    this.jsUrl = "https://picsart.com/-/landings/4.290.0/static/index-msH24PNW-B73n3SC9.js";
  }

  async getAuthToken() {
    if (this.authToken) return this.authToken;
    
    try {
      const response = await axios.get(this.jsUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/132.0.0.0 Mobile Safari/537.36'
        }
      });
      
      const tokenMatch = response.data.match(/"x-app-authorization":"Bearer ([^"]+)"/);
      if (!tokenMatch) throw new Error('Token not found');
      
      this.authToken = `Bearer ${tokenMatch[1]}`;
      return this.authToken;
    } catch (error) {
      console.error("Error getting auth token:", error);
      throw error;
    }
  }

  async uploadBuffer(buffer) {
    await this.getAuthToken();

    const formData = new FormData();
    formData.append('type', 'editing-temp-landings');
    formData.append('file', buffer, {
      filename: 'image.jpeg',
      contentType: 'image/jpeg'
    });
    formData.append('url', '');
    formData.append('metainfo', '');

    try {
      const response = await axios.post(this.uploadUrl, formData, {
        headers: {
          ...formData.getHeaders(),
          'authority': 'upload.picsart.com',
          'accept': '*/*',
          'accept-language': 'id-ID,id;q=0.9,en-US;q=0.8,en;q=0.7',
          'origin': 'https://picsart.com',
          'referer': 'https://picsart.com/',
          'sec-ch-ua': '"Not A(Brand";v="8", "Chromium";v="132"',
          'sec-ch-ua-mobile': '?1',
          'sec-ch-ua-platform': '"Android"',
          'sec-fetch-dest': 'empty',
          'sec-fetch-mode': 'cors',
          'sec-fetch-site': 'same-site',
          'user-agent': 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/132.0.0.0 Mobile Safari/537.36'
        }
      });

      return response.data.result.url;
    } catch (error) {
      console.error("Error uploading buffer:", error);
      throw error;
    }
  }

  async uploadFromUrl(imageUrl) {
    await this.getAuthToken();
    
    try {
      const imageResponse = await axios.get(imageUrl, { responseType: 'arraybuffer' });
      const buffer = Buffer.from(imageResponse.data);
      return await this.uploadBuffer(buffer);
    } catch (error) {
      console.error("Error uploading from URL:", error);
      throw error;
    }
  }

  async enhanceImage(imageUrl, targetScale = 4) {
    const scale = Math.max(1, Math.min(20, targetScale));
    
    const params = new URLSearchParams({
      picsart_cdn_url: imageUrl,
      format: 'PNG',
      model: 'REALESERGAN'
    });

    const payload = {
      image_url: imageUrl,
      colour_correction: {
        enabled: false,
        blending: 0.5
      },
      face_enhancement: {
        enabled: true,
        blending: 1,
        max_faces: 1000,
        impression: false,
        gfpgan: true,
        node: "ada"
      },
      seed: 42,
      upscale: {
        enabled: true,
        node: "esrgan",
        target_scale: scale
      }
    };

    try {
      const response = await axios.post(`${this.enhanceUrl}?${params.toString()}`, payload, {
        headers: {
          'authority': 'ai.picsart.com',
          'accept': 'application/json',
          'accept-language': 'id-ID,id;q=0.9,en-US;q=0.8,en;q=0.7',
          'content-type': 'application/json',
          'origin': 'https://picsart.com',
          'referer': 'https://picsart.com/',
          'sec-ch-ua': '"Not A(Brand";v="8", "Chromium";v="132"',
          'sec-ch-ua-mobile': '?1',
          'sec-ch-ua-platform': '"Android"',
          'sec-fetch-dest': 'empty',
          'sec-fetch-mode': 'cors',
          'sec-fetch-site': 'same-site',
          'user-agent': 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/132.0.0.0 Mobile Safari/537.36',
          'x-app-authorization': this.authToken,
          'x-touchpoint': 'widget_EnhancedImage',
          'x-touchpoint-referrer': '/image-upscale/'
        }
      });

      return response.data;
    } catch (error) {
      console.error("Error enhancing image:", error);
      throw error;
    }
  }

  async checkStatus(jobId) {
    try {
      const response = await axios.get(`${this.enhanceUrl}/${jobId}`, {
        headers: {
          'authority': 'ai.picsart.com',
          'accept': 'application/json',
          'accept-language': 'id-ID,id;q=0.9,en-US;q=0.8,en;q=0.7',
          'origin': 'https://picsart.com',
          'referer': 'https://picsart.com/',
          'sec-ch-ua': '"Not A(Brand";v="8", "Chromium";v="132"',
          'sec-ch-ua-mobile': '?1',
          'sec-ch-ua-platform': '"Android"',
          'sec-fetch-dest': 'empty',
          'sec-fetch-mode': 'cors',
          'sec-fetch-site': 'same-site',
          'user-agent': 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/132.0.0.0 Mobile Safari/537.36',
          'x-app-authorization': this.authToken
        }
      });

      return response.data;
    } catch (error) {
      console.error("Error checking status:", error);
      throw error;
    }
  }

  async waitForCompletion(jobId) {
    while (true) {
      try {
        const status = await this.checkStatus(jobId);
        
        if (status.status === 'DONE') {
          return status.result.image_url;
        }
        
        if (status.status === 'FAILED') {
          throw new Error(`Enhancement failed: ${status.error_message}`);
        }
        
        await new Promise(resolve => setTimeout(resolve, 2000));
      } catch (error) {
        console.error("Error waiting for completion:", error);
        throw error;
      }
    }
  }

  async downloadBuffer(url) {
    try {
      const response = await axios.get(url, { responseType: 'arraybuffer' });
      return Buffer.from(response.data);
    } catch (error) {
      console.error("Error downloading buffer:", error);
      throw error;
    }
  }

  async upscale(input, targetScale = 4) {
    let uploadedUrl;
    
    try {
      if (Buffer.isBuffer(input)) {
        uploadedUrl = await this.uploadBuffer(input);
      } else if (typeof input === 'string') {
        uploadedUrl = await this.uploadFromUrl(input);
      } else {
        throw new Error('Input must be Buffer or URL string');
      }
      
      const enhanceResponse = await this.enhanceImage(uploadedUrl, targetScale);
      const resultUrl = await this.waitForCompletion(enhanceResponse.id);
      return await this.downloadBuffer(resultUrl);
    } catch (error) {
      console.error("Error in upscale process:", error);
      throw error;
    }
  }
}

const upscaler = new PicsArtUpscaler();

async function UpscaleImageFromUrl(imageUrl, scale = 4) {
  try {
    const result = await upscaler.upscale(imageUrl, scale);
    return {
      buffer: result,
      scale: scale
    };
  } catch (error) {
    console.error("Error upscaling image from URL:", error);
    throw error;
  }
}

async function UpscaleImageFromFile(imageBuffer, scale = 4, fileName = "image.jpg") {
  try {
    const fileType = await fileTypeFromBuffer(imageBuffer);
    if (!fileType || !fileType.mime.startsWith("image/")) {
      throw new Error("Unsupported file type, only images are allowed.");
    }

    const result = await upscaler.upscale(imageBuffer, scale);
    return {
      buffer: result,
      scale: scale
    };
  } catch (error) {
    console.error("Error upscaling image from file:", error);
    throw error;
  }
}

export default (app) => {
  // GET endpoint - upscale from URL
  app.get("/api/tools/upscale", createApiKeyMiddleware(), async (req, res) => {
    try {
      const { url, scale } = req.query;

      if (!url) {
        return res.status(400).json({
          status: false,
          error: "Parameter 'url' is required.",
        });
      }

      if (typeof url !== "string" || url.trim().length === 0) {
        return res.status(400).json({
          status: false,
          error: "Parameter 'url' must be a non-empty string.",
        });
      }

      const targetScale = scale ? parseInt(scale) : 4;
      if (isNaN(targetScale) || targetScale < 1 || targetScale > 20) {
        return res.status(400).json({
          status: false,
          error: "Parameter 'scale' must be a number between 1 and 20.",
        });
      }

      try {
        new URL(url.trim());

        const result = await UpscaleImageFromUrl(url.trim(), targetScale);

        res.writeHead(200, {
          "Content-Type": "image/png",
          "Content-Length": result.buffer.length,
          "Cache-Control": "public, max-age=3600",
          "Content-Disposition": `inline; filename="upscaled_${Date.now()}.png"`
        });
        res.end(result.buffer);
      } catch (urlError) {
        return res.status(400).json({
          status: false,
          error: "Invalid URL format.",
        });
      }
    } catch (error) {
      console.error("Error in upscale GET endpoint:", error);
      res.status(500).json({
        status: false,
        error: error.message || "Internal Server Error",
      });
    }
  });

  // POST endpoint - upscale from file upload
  app.post("/api/tools/upscale", createApiKeyMiddleware(), upload.single('image'), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({
          status: false,
          error: "File 'image' is required in multipart/form-data.",
        });
      }

      // Get scale parameter from form data if provided
      const targetScale = req.body.scale ? parseInt(req.body.scale) : 4;
      
      if (isNaN(targetScale) || targetScale < 1 || targetScale > 20) {
        return res.status(400).json({
          status: false,
          error: "Parameter 'scale' must be a number between 1 and 20.",
        });
      }

      // Use the buffer from memory
      const fileBuffer = req.file.buffer;
      
      try {
        const result = await UpscaleImageFromFile(fileBuffer, targetScale, req.file.originalname);
        
        res.writeHead(200, {
          "Content-Type": "image/png",
          "Content-Length": result.buffer.length,
          "Cache-Control": "public, max-age=3600",
          "Content-Disposition": `inline; filename="upscaled_${Date.now()}.png"`
        });
        res.end(result.buffer);
      } catch (processError) {
        console.error("Error processing uploaded image:", processError);
        throw processError;
      }
    } catch (error) {
      console.error("Error in upscale POST endpoint:", error);
      res.status(500).json({
        status: false,
        error: error.message || "Internal Server Error",
      });
    }
  });
}