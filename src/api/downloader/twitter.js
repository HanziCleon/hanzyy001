import axios from "axios";
import cheerio from "cheerio";
import qs from "querystring";
import {
  createApiKeyMiddleware
} from "../../middleware/apikey.js";

class TwitterDownloader {
  constructor() {
    this.base = "https://x2twitter.com";
  }

  async download({
    url
  }) {
    if (!url || !url.includes("twitter.com") && !url.includes("x.com")) {
      return {
        status: false,
        code: 400,
        result: {
          message: "Parameter 'url' tidak valid. Harap masukkan URL X/Twitter."
        },
      };
    }

    try {
      // Langkah 1: Mendapatkan token verifikasi
      const verifyRes = await axios.post(`${this.base}/api/userverify`, qs.stringify({
        url
      }));
      const token = verifyRes.data?.token;

      if (!token) {
        throw new Error("Gagal mendapatkan token verifikasi dari server.");
      }

      // Langkah 2: Mencari data video dengan token
      const searchRes = await axios.post(
        `${this.base}/api/ajaxSearch`,
        qs.stringify({
          q: url,
          lang: "id",
          cftoken: token
        })
      );

      if (searchRes.data.status !== "ok") {
        throw new Error("Gagal memproses URL. Video mungkin tidak ditemukan atau URL tidak valid.");
      }

      // Langkah 3: Mengekstrak data dari HTML
      const $ = cheerio.load(searchRes.data.data);
      const downloads = [];
      $(".dl-action a").each((_, el) => {
        const quality = $(el).text().trim().replace("Download ", "");
        const link = $(el).attr("href");
        if (link && quality) {
          downloads.push({
            quality,
            url: link
          });
        }
      });

      if (downloads.length === 0) {
        throw new Error("Tidak ada link unduhan yang ditemukan.");
      }

      const title = $(".tw-middle h3").text().trim();
      const thumbnail = $(".thumbnail img").attr("src");

      return {
        status: true,
        code: 200,
        result: {
          title,
          thumbnail,
          downloads,
        },
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

const twitter = new TwitterDownloader();

export default (app) => {
  app.all("/downloader/twitter", createApiKeyMiddleware(), async (req, res) => {
    const {
      url
    } = req.query.url ? req.query : req.body;
    const result = await twitter.download({
      url
    });
    res.status(result.code).json(result);
  });
};