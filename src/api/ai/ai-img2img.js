import axios from "axios";
import FormData from "form-data";
import crypto from "crypto";
import {
  createApiKeyMiddleware
} from "../../middleware/apikey.js";

class ImageToImageAI {
  #randomFpId() {
    return crypto.randomBytes(16).toString("hex");
  }

  #makeHeaders() {
    return {
      "accept": "*/*",
      "accept-language": "id-ID",
      "x-fp-id": this.#randomFpId(),
      "Referer": "https://nanana.app/",
      "Referrer-Policy": "strict-origin-when-cross-origin",
    };
  }

  async generate({
    url,
    prompt
  }) {
    if (!url || !prompt) {
      return {
        status: false,
        code: 400,
        result: {
          message: "Parameter 'url' (gambar) dan 'prompt' (teks) diperlukan."
        },
      };
    }

    try {
      // 1. Unduh gambar dari URL
      const imageResponse = await axios.get(url, {
        responseType: "arraybuffer"
      });
      const imageBuffer = Buffer.from(imageResponse.data, "binary");

      // 2. Unggah gambar
      const form = new FormData();
      form.append("image", imageBuffer, "image.jpg");
      const uploadRes = await axios.post("https://nanana.app/api/upload-img", form, {
        headers: {
          ...this.#makeHeaders(),
          ...form.getHeaders()
        },
      });

      const uploadJson = uploadRes.data;
      if (!uploadJson.success) throw new Error("Gagal mengunggah gambar sumber.");
      const uploadedUrl = uploadJson.url;

      await new Promise((r) => setTimeout(r, 2000));

      // 3. Kirim permintaan untuk generate gambar
      const generateRes = await axios.post(
        "https://nanana.app/api/image-to-image", {
          prompt,
          image_urls: [uploadedUrl]
        }, {
          headers: {
            ...this.#makeHeaders(),
            "content-type": "application/json"
          },
        }
      );

      const generateJson = generateRes.data;
      if (!generateJson.success) throw new Error("Gagal membuat request generate gambar.");
      const requestId = generateJson.request_id;

      // 4. Periksa hasil secara berkala
      let maxAttempts = 20; // Batas percobaan agar tidak terjadi infinite loop
      while (maxAttempts > 0) {
        const checkRes = await axios.post(
          "https://nanana.app/api/get-result", {
            requestId,
            type: "image-to-image"
          }, {
            headers: {
              ...this.#makeHeaders(),
              "content-type": "application/json"
            },
          }
        );

        const resultJson = checkRes.data;
        if (resultJson.completed && resultJson.data?.images?.length) {
          return {
            status: true,
            code: 200,
            result: {
              prompt,
              source_image_url: uploadedUrl,
              generated_image_url: resultJson.data.images[0].url,
            },
          };
        }

        maxAttempts--;
        await new Promise((r) => setTimeout(r, 5000)); // Tunggu 5 detik sebelum cek lagi
      }
      throw new Error("Proses generate gambar memakan waktu terlalu lama (timeout).");

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

const img2img = new ImageToImageAI();

export default (app) => {
  app.all("/ai/img2img", createApiKeyMiddleware(), async (req, res) => {
    const {
      url,
      prompt
    } = req.query.url ? req.query : req.body;
    const result = await img2img.generate({
      url,
      prompt
    });
    res.status(result.code).json(result);
  });
};