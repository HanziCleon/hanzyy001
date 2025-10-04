import axios from "axios";
import { createApiKeyMiddleware } from "../../middleware/apikey.js";

/**
 * Fungsi utilitas untuk memproses OCR dari URL gambar.
 * @param {string} imageUrl - URL publik dari gambar.
 * @returns {string} Teks hasil ekstraksi OCR.
 */
async function ocrFromUrl(imageUrl) {
  if (!imageUrl) {
    throw new Error("URL gambar tidak valid atau tidak disediakan.");
  }

  try {
    // POST ke API OCR dengan body berisi imageUrl
    const response = await axios.post(
      "https://staging-ai-image-ocr-266i.frontend.encr.app/api/ocr/process",
      { imageUrl },
      { headers: { "Content-Type": "application/json" } }
    );

    if (response.data && response.data.extractedText) {
      return response.data.extractedText;
    } else {
      throw new Error("Tidak ada teks yang berhasil diekstrak.");
    }
  } catch (error) {
    if (error.response) {
      throw new Error(`OCR API error: ${error.response.status} - Gagal memproses gambar.`);
    } else {
      throw new Error(`OCR gagal: ${error.message}`);
    }
  }
}

export default (app) => {
  app.all("/api/ocr/image", createApiKeyMiddleware(), async (req, res) => {
    try {
      const imageUrl = req.query.url || req.body.url;
      if (!imageUrl) {
        return res.status(400).json({
          status: false,
          error: "Missing required parameter",
          message: "Parameter 'url' untuk gambar diperlukan",
        });
      }

      const extractedText = await ocrFromUrl(imageUrl);

      res.json({
        status: true,
        extractedText,
      });
    } catch (error) {
      console.error("OCR Router Error:", error);
      res.status(500).json({
        status: false,
        error: "OCR failed",
        message: error.message || "Gagal melakukan OCR pada gambar",
      });
    }
  });
};