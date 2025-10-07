// /src/api/image/enhancer.js (Struktur Router Langsung)

import axios from "axios";
import FormData from "form-data";
import { createApiKeyMiddleware } from "../../middleware/apikey.js"; // Middleware Anda

/**
 * Fungsi utilitas untuk memproses enhancement gambar.
 * @param {string} url - URL publik dari gambar.
 * @returns {Buffer} Buffer gambar yang sudah di-enhance.
 * @throws {Error} Jika ada kegagalan dalam proses.
 */
async function enhanceImage(url) {
  if (!url) {
    throw new Error("URL gambar tidak valid atau tidak disediakan.");
  }

  try {
    // 1. Unduh Gambar
    const imgResponse = await axios.get(url, { responseType: 'arraybuffer' });
    const buffer = Buffer.from(imgResponse.data, 'binary');

    // 2. Persiapkan FormData
    const form = new FormData();
    form.append('method', '1'); 
    form.append('is_pro_version', 'false');
    form.append('is_enhancing_more', 'false');
    form.append('max_image_size', 'high');
    form.append('file', buffer, `image_${Date.now()}.jpg`); 

    // 3. Kirim Permintaan ke ihancer.com
    const { data } = await axios.post('https://ihancer.com/api/enhance', form, {
      headers: { 
        ...form.getHeaders(), 
        'accept-encoding': 'gzip', 
        'host': 'ihancer.com', 
        'user-agent': 'Dart/3.5 (dart:io)' // Meniru user-agent aplikasi
      },
      responseType: 'arraybuffer' // Dapatkan hasil sebagai buffer
    });

    return Buffer.from(data);
  } catch (error) {
    console.error("Image Enhancer Error:", error.message);
    
    // Memberikan pesan error yang lebih informatif
    if (error.code === 'ECONNABORTED') {
      throw new Error("Request timeout - Enhancer API took too long to respond.");
    } else if (error.response) {
      throw new Error(`Enhancer API error: ${error.response.status} - Gagal memproses gambar.`);
    } else {
      throw new Error(`Peningkatan gambar gagal: ${error.message}`);
    }
  }
}


export default (app) => {
  // Endpoint GET dan POST untuk Image Enhancer
  app.all("/api/enhance/image", createApiKeyMiddleware(), async (req, res) => {
    try {
      // Ambil 'url' dari query (GET) atau body (POST)
      const { url } = req.query.url ? req.query : req.body; 

      if (!url) {
        return res.status(400).json({
          status: false,
          error: "Missing required parameter",
          message: "The 'url' parameter of the image is required",
        });
      }

      const imageBuffer = await enhanceImage(url);
      
      // Mengirimkan buffer gambar dengan header yang sesuai
      res.setHeader("Content-Type", "image/jpeg");
      res.setHeader("Content-Length", imageBuffer.length);
      res.setHeader("Cache-Control", "public, max-age=3600");
      res.setHeader("Content-Disposition", `inline; filename="enhanced_${Date.now()}.jpeg"`);
      
      res.end(imageBuffer);

    } catch (error) {
      console.error("Image Enhancer Router Error:", error);
      
      res.status(500).json({
        status: false,
        error: "Image enhancement failed",
        message: error.message || "Failed to enhance image",
      });
    }
  });
};
