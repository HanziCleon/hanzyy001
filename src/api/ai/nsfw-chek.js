import axios from "axios";
import FormData from "form-data";
import {
  createApiKeyMiddleware
} from "../../middleware/apikey.js";

class NsfwChecker {
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
      const imageResponse = await axios.get(url, {
        responseType: "arraybuffer"
      });
      const imageBuffer = Buffer.from(imageResponse.data, "binary");

      const form = new FormData();
      form.append("file", imageBuffer, "image.jpg");

      const {
        data
      } = await axios.post(
        "https://www.nyckel.com/v1/functions/o2f0jzcdyut2qxhu/invoke",
        form, {
          headers: {
            ...form.getHeaders(),
            "x-requested-with": "XMLHttpRequest",
          },
        }
      );

      return {
        status: true,
        code: 200,
        result: {
          label: data.labelName,
          confidence: data.confidence,
        },
      };
    } catch (error) {
      const errorMessage = error.response?.data?.message || error.message;
      return {
        status: false,
        code: 500,
        result: {
          message: errorMessage
        },
      };
    }
  }
}

const nsfw = new NsfwChecker();

export default (app) => {
  app.all("/ai/nsfw-check", createApiKeyMiddleware(), async (req, res) => {
    const {
      url
    } = req.query.url ? req.query : req.body;
    const result = await nsfw.process({
      url
    });
    res.status(result.code).json(result);
  });
};