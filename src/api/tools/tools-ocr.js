import axios from "axios";
import { createApiKeyMiddleware } from "../../middleware/apikey.js"; // Sesuaikan path middleware Anda

/**
 * Fungsi utilitas untuk memproses OCR pada gambar dari URL.
 * @param {string} imageUrl - URL publik dari gambar.
 * @returns {string} Teks yang diekstrak dari gambar.
 * @throws {Error} Jika ada kegagalan dalam proses.
 */
async function processImageOcr(imageUrl) {
  if (!imageUrl) {
    throw new Error("URL gambar tidak valid atau tidak disediakan.");
  }

  try {
    // 1. Unduh Gambar dan dapatkan Buffer
    const imgResponse = await axios.get(imageUrl, { responseType: 'arraybuffer' });
    const buffer = Buffer.from(imgResponse.data);

    // 2. Tentukan MIME Type dan konversi ke Base64
    const contentType = imgResponse.headers['content-type'] || 'image/jpeg';
    const mimeType = contentType.split(';')[0]; // Ambil hanya mime type, abaikan charset
    const imageBase64 = buffer.toString("base64");
    
    // 3. Persiapan Payload dan URL OCR
    const url = "https://staging-ai-image-ocr-266i.frontend.encr.app/api/ocr/process";
    const payload = { 
        imageBase64, 
        mimeType: mimeType.startsWith('image/') ? mimeType : 'image/jpeg' 
    };

    // 4. Kirim Permintaan ke API OCR
    const res = await axios.post(url, payload, {
      headers: { "content-type": "application/json" }
    });

    const { extractedText } = res.data;

    if (!extractedText) {
        throw new Error("API OCR gagal mengekstrak teks.");
    }

    return extractedText;

  } catch (error) {
    console.error("Image OCR Error:", error.message);
    
    if (error.response) {
      // Menangkap error dari server OCR (e.g., status 400/500)
      throw new Error(`OCR API error: ${error.response.status} - ${error.response.data?.message || "Gagal memproses gambar."}`);
    } else {
      throw new Error(`Ekstraksi teks gagal: ${error.message}`);
    }
  }
}

class ImageOcr {
  async extract({ url }) {
    if (!url) {
      return {
        status: false,
        code: 400,
        result: { message: "URL parameter is required" },
      };
    }

    try {
      const extractedText = await processImageOcr(url);

      return {
        status: true,
        code: 200,
        result: {
          original_url: url,
          extracted_text: extractedText,
        },
      };
    } catch (err) {
      return {
        status: false,
        code: err.message.includes("tidak valid") ? 400 : 500,
        result: { message: err.message || "Internal Server Error" },
      };
    }
  }
}

const imageOcr = new ImageOcr();

export default (app) => {
  const endpointPath = "/api/ocr/image";
  
  // Endpoint GET dan POST untuk Image OCR (sesuai contoh yang Anda berikan)
  app.all(endpointPath, createApiKeyMiddleware(), async (req, res) => {
    try {
      // Ambil 'url' dari query (GET) atau body (POST)
      const { url } = req.query.url ? req.query : req.body; 

      const result = await imageOcr.extract({ url });
      res.status(result.code).json(result);

    } catch (error) {
      console.error("Image OCR Router Error:", error);
      
      res.status(500).json({
        status: false,
        error: "Internal Server Error",
        message: error.message || "Failed to process OCR",
      });
    }
  });
};
