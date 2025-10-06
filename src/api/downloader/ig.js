import axios from "axios";
import qs from "qs";
import { createApiKeyMiddleware } from "../../middleware/apikey.js";

class InstagramDownloader {
  constructor() {
    this.sources = [
      {
        name: "snapins",
        url: "https://snapins.ai/action.php",
        method: "POST",
        body: (url) => qs.stringify({ url }),
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/108.0.0.0 Safari/537.36",
        },
        parse: (data) => {
          if (data.status !== "success" || !data.data?.length)
            throw new Error("Snapins gagal memuat media");
          return data.data.map((item) => ({
            type: item.type,
            thumbnail: item.thumbnail,
            url: item.url,
            source: "snapins.ai",
          }));
        },
      },
      {
        name: "igram",
        url: "https://igram.world/api/igdl",
        method: "POST",
        body: (url) => ({ url }),
        headers: {
          "Content-Type": "application/json",
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/108.0.0.0 Safari/537.36",
        },
        parse: (data) => {
          if (!data.data || data.data.length === 0)
            throw new Error("iGram gagal memuat media");
          return data.data.map((item) => ({
            type: item.type || (item.url?.endsWith(".mp4") ? "video" : "image"),
            thumbnail: item.thumbnail || item.url,
            url: item.url,
            source: "igram.world",
          }));
        },
      },
    ];
  }

  async download({ url }) {
    if (!url || !url.includes("instagram.com")) {
      return {
        status: false,
        code: 400,
        result: {
          message:
            "Parameter 'url' tidak valid. Harap masukkan URL Instagram yang benar.",
        },
      };
    }

    for (const src of this.sources) {
      try {
        const { data } = await axios({
          method: src.method,
          url: src.url,
          data: src.body(url),
          headers: src.headers,
          timeout: 15000,
        });

        const result = src.parse(data);
        return {
          status: true,
          code: 200,
          result,
        };
      } catch (err) {
        console.log(`[❌] Gagal di ${src.name}: ${err.message}`);
        continue; // coba sumber berikutnya
      }
    }

    return {
      status: false,
      code: 500,
      result: {
        message:
          "Gagal mengambil media dari semua sumber. Coba ulangi atau pastikan postingan tidak private.",
      },
    };
  }
}

const instagram = new InstagramDownloader();

export default (app) => {
  app.all(
    "/downloader/instagram",
    createApiKeyMiddleware(),
    async (req, res) => {
      const { url } = req.query.url ? req.query : req.body;
      const result = await instagram.download({ url });
      res.status(result.code).json(result);
    }
  );
};