import axios from "axios";
import qs from "qs";
import {
  createApiKeyMiddleware
} from "../../middleware/apikey.js";

class YouTubeDownloader {
  constructor() {
    this.api = "https://ytdown.io/proxy.php";
    this.headers = {
      "content-type": "application/x-www-form-urlencoded; charset=UTF-8",
      "user-agent": "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/127.0.0.0 Mobile Safari/537.36",
    };
  }

  async #getFinalUrl(mediaUrl) {
    const data = qs.stringify({
      url: mediaUrl
    });
    const response = await axios.post(this.api, data, {
      headers: this.headers
    });
    return response.data?.api?.fileUrl;
  }

  async download({
    url
  }) {
    if (!url || !url.includes("youtu")) {
      return {
        status: false,
        code: 400,
        result: {
          message: "Parameter 'url' tidak valid. Harap masukkan URL YouTube."
        },
      };
    }

    try {
      // Fase 1: Dapatkan informasi video
      const initialData = qs.stringify({
        url
      });
      const {
        data
      } = await axios.post(this.api, initialData, {
        headers: this.headers
      });

      const videoInfo = data.api;
      if (!videoInfo || !videoInfo.mediaItems) {
        throw new Error("Informasi video tidak ditemukan.");
      }

      // Fase 2: Dapatkan URL unduhan final untuk setiap resolusi
      const downloadsVideo = [];
      for (const item of videoInfo.mediaItems) {
        if (item.type.toLowerCase() === "video" && item.mediaRes) {
          const finalUrl = await this.#getFinalUrl(item.mediaUrl);
          downloadsVideo.push({
            resolution: item.mediaRes,
            size: item.mediaFileSize,
            extension: item.mediaExtension,
            url: finalUrl,
          });
        }
      }

      return {
        status: true,
        code: 200,
        result: {
          title: videoInfo.title,
          thumbnail: videoInfo.imagePreviewUrl,
          channel: {
            name: videoInfo.userInfo?.name || null,
            username: videoInfo.userInfo?.username || null,
            verified: videoInfo.userInfo?.isVerified || false,
            avatar: videoInfo.userInfo?.userAvatar || null,
          },
          downloads: downloadsVideo,
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

const youtube = new YouTubeDownloader();

export default (app) => {
  app.all("/downloader/youtube", createApiKeyMiddleware(), async (req, res) => {
    const {
      url
    } = req.query.url ? req.query : req.body;
    const result = await youtube.download({
      url
    });
    res.status(result.code).json(result);
  });
};