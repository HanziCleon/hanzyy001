import axios from "axios";
import {
  createApiKeyMiddleware
} from "../../middleware/apikey.js";

class InstagramDownloader {
  constructor() {
    this.base = "https://snapins.ai/action.php";
  }

  async download({
    url
  }) {
    if (!url || !url.includes("instagram.com")) {
      return {
        status: false,
        code: 400,
        result: {
          message: "Parameter 'url' tidak valid. Harap masukkan URL Instagram."
        },
      };
    }

    try {
      const {
        data
      } = await axios.post(this.base, {
        url
      }, {
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/108.0.0.0 Safari/537.36",
        },
      });

      if (data.status !== "success" || !data.data || data.data.length === 0) {
        throw new Error("Media tidak ditemukan. Pastikan URL benar dan akun tidak private.");
      }

      // Memformat ulang hasil agar lebih bersih
      const resultData = data.data.map((item) => ({
        type: item.type, // 'video' or 'image'
        thumbnail: item.thumbnail,
        url: item.url,
      }));

      return {
        status: true,
        code: 200,
        result: resultData,
      };
    } catch (error) {
      return {
        status: false,
        code: 500,
        result: {
          message: error.message
        },
      };
    }
  }
}

const instagram = new InstagramDownloader();

export default (app) => {
  app.all("/downloader/instagram", createApiKeyMiddleware(), async (req, res) => {
    const {
      url
    } = req.query.url ? req.query : req.body;
    const result = await instagram.download({
      url
    });
    res.status(result.code).json(result);
  });
};