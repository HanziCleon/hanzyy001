import axios from "axios";
import FormData from "form-data";
import {
  createApiKeyMiddleware
} from "../../middleware/apikey.js";

class BackgroundRemover {
  async process({
    url
  }) {
    if (!url) {
      return {
        status: false,
        code: 400,
        result: {
          message: "Parameter 'url' gambar diperlukan."
        },
      };
    }

    try {
      // Unduh gambar dari URL menjadi buffer
      const imageResponse = await axios.get(url, {
        responseType: "arraybuffer"
      });
      const imageBuffer = Buffer.from(imageResponse.data, "binary");

      // Buat form data untuk diunggah
      const form = new FormData();
      form.append("file", imageBuffer, "image.jpg");

      const {
        data
      } = await axios.post("https://removebg.one/api/predict/v2", form, {
        headers: {
          ...form.getHeaders(),
          accept: "application/json, text/plain, */*",
          platform: "PC",
          product: "REMOVEBG",
        },
      });

      if (!data || !data.data) {
        throw new Error("Gagal memproses gambar dari API removebg.");
      }

      return {
        status: true,
        code: 200,
        result: {
          original_url: data.data.url,
          no_background_url: data.data.cutoutUrl,
          mask_url: data.data.maskUrl,
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

const remover = new BackgroundRemover();

export default (app) => {
  app.all("/tools/removebg", createApiKeyMiddleware(), async (req, res) => {
    const {
      url
    } = req.query.url ? req.query : req.body;
    const result = await remover.process({
      url
    });
    res.status(result.code).json(result);
  });
};