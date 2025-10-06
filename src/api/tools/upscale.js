import axios from "axios";
import FormData from "form-data";
import {
  createApiKeyMiddleware
} from "../../middleware/apikey.js";

class ImageUpscaler {
  async process({
    url,
    scale = 2
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
      // 1. Unduh gambar dari URL
      const imageResponse = await axios.get(url, {
        responseType: "arraybuffer"
      });
      const imageBuffer = Buffer.from(imageResponse.data, "binary");

      // 2. Unggah gambar untuk mendapatkan 'code'
      const form = new FormData();
      form.append("file", imageBuffer, "image.jpg");
      const uploadRes = await axios.post("https://get1.imglarger.com/api/UpscalerNew/UploadNew", form, {
        headers: form.getHeaders(),
      });

      const code = uploadRes.data?.data?.code;
      if (!code) {
        throw new Error("Gagal mengunggah gambar atau mendapatkan kode proses.");
      }

      // 3. Periksa status secara berkala hingga selesai
      while (true) {
        await new Promise((r) => setTimeout(r, 3000)); // Jeda 3 detik
        const checkStatusRes = await axios.post("https://get1.imglarger.com/api/UpscalerNew/CheckStatusNew", {
          code,
          scaleRadio: scale
        });

        const data = checkStatusRes.data?.data;
        if (data && data.status === "success") {
          return {
            status: true,
            code: 200,
            result: {
              original_filename: data.originalfilename,
              scale_factor: scale,
              download_url: data.downloadUrls[0],
            },
          };
        }
        if (data && data.status === "failed") {
          throw new Error("Proses upscale gagal dari sisi server.");
        }
      }
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

const upscaler = new ImageUpscaler();

export default (app) => {
  app.all("/tools/upscale", createApiKeyMiddleware(), async (req, res) => {
    const {
      url,
      scale
    } = req.query.url ? req.query : req.body;
    const result = await upscaler.process({
      url,
      scale
    });
    res.status(result.code).json(result);
  });
};