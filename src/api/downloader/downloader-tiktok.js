// d-tiktok.js
import axios from "axios";
import * as cheerio from "cheerio";
import FormData from "form-data";
import * as tough from "tough-cookie";
import { createApiKeyMiddleware } from "../../middleware/apikey.js";

class SnapTikClient {
  constructor(config = {}) {
    this.config = { baseURL: "https://snaptik.app", ...config };
    const cookieJar = new tough.CookieJar();

    this.axios = axios.create({
      ...this.config,
      withCredentials: true,
      jar: cookieJar,
      headers: {
        "User-Agent": "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/132.0.0.0 Mobile Safari/537.36",
        "sec-ch-ua": '"Not A(Brand";v="8", "Chromium";v="132"',
        "sec-ch-ua-mobile": "?1",
        "sec-ch-ua-platform": '"Android"',
        "Upgrade-Insecure-Requests": "1"
      },
      timeout: 30000
    });
  }

  async get_token() {
    const { data } = await this.axios.get("/en2", { headers: { Referer: "https://snaptik.app/en2" } });
    const $ = cheerio.load(data);
    return $("input[name=\"token\"]").val();
  }

  async get_script(url) {
    const form = new FormData();
    const token = await this.get_token();
    if (!token) throw new Error("Failed to get token");

    form.append("url", url);
    form.append("lang", "en2");
    form.append("token", token);

    const { data } = await this.axios.post("/abc2.php", form, {
      headers: { ...form.getHeaders(), Referer: "https://snaptik.app/en2" }
    });
    return data;
  }

  async eval_script(script1) {
    const script2 = await new Promise((resolve) => Function("eval", script1)(resolve));
    return new Promise((resolve, reject) => {
      let html = "";
      const mock = {
        $: () => ({ remove() {}, style: { display: "" }, get innerHTML() { return html }, set innerHTML(t) { html = t } }),
        app: { showAlert: reject },
        document: { getElementById: () => ({ src: "" }) },
        fetch: (a) => { resolve({ html, oembed_url: a }); return { json: () => ({ thumbnail_url: "" }) } },
        gtag: () => 0,
        Math: { round: () => 0 },
        XMLHttpRequest: function () { return { open() {}, send() {} } },
        window: { location: { hostname: "snaptik.app" } }
      };
      try {
        Function(...Object.keys(mock), script2)(...Object.values(mock));
      } catch (e) {
        reject(e);
      }
    });
  }

  async get_hd_video(hdUrl, backupUrl) {
    try {
      const { data } = await this.axios.get(hdUrl);
      if (data && data.url) return data.url;
    } catch {}
    return backupUrl;
  }

  async parse_html(html) {
    const $ = cheerio.load(html);
    const isVideo = !$("div.render-wrapper").length;

    const thumbnail = $(".avatar").attr("src") || $("#thumbnail").attr("src");
    const title = $(".video-title").text().trim();
    const creator = $(".info span").text().trim();

    if (isVideo) {
      const hdButton = $("div.video-links > button[data-tokenhd]");
      const hdTokenUrl = hdButton.data("tokenhd");
      const backupUrl = hdButton.data("backup");

      let hdUrl = hdTokenUrl ? await this.get_hd_video(hdTokenUrl, backupUrl) : null;

      const videoUrls = [
        hdUrl || backupUrl,
        ...$("div.video-links > a:not(a[href=\"/\"])")
          .map((_, el) => $(el).attr("href"))
          .get()
          .filter((u) => u && !u.includes("play.google.com"))
          .map((u) => (u.startsWith("/") ? this.config.baseURL + u : u))
      ].filter(Boolean);

      return { type: "video", urls: videoUrls, metadata: { title, description: title, thumbnail, creator } };
    } else {
      const photos = $("div.columns > div.column > div.photo")
        .map((_, el) => ({
          urls: [
            $(el).find("img[alt=\"Photo\"]").attr("src"),
            $(el).find("a[data-event=\"download_albumPhoto_photo\"]").attr("href")
          ]
        }))
        .get();

      return {
        type: photos.length === 1 ? "photo" : "slideshow",
        urls: photos.length === 1 ? photos[0].urls : photos.map((p) => p.urls),
        metadata: { title, description: title, thumbnail, creator }
      };
    }
  }

  async process(url) {
    try {
      const script = await this.get_script(url);
      const { html, oembed_url } = await this.eval_script(script);
      const result = await this.parse_html(html);

      return { original_url: url, oembed_url, type: result.type, urls: result.urls, metadata: result.metadata };
    } catch (e) {
      return { original_url: url, error: e.message };
    }
  }
}

async function scrapeTiktok(url) {
  try {
    const client = new SnapTikClient();
    return await client.process(url);
  } catch (e) {
    return null;
  }
}

export default (app) => {
  const handler = async (inputUrl, res) => {
    if (!inputUrl || typeof inputUrl !== "string" || !inputUrl.trim()) {
      return res.status(400).json({ status: false, error: "URL parameter is required" });
    }

    const result = await scrapeTiktok(inputUrl.trim());
    if (!result || result.error) {
      return res.status(500).json({ status: false, error: result?.error || "Failed to process TikTok URL" });
    }

    return res.status(200).json({ status: true, data: result, timestamp: new Date().toISOString() });
  };

  // GET
  app.get("/api/d/tiktok", createApiKeyMiddleware(), async (req, res) => {
    await handler(req.query.url, res);
  });

  // POST
  app.post("/api/d/tiktok", createApiKeyMiddleware(), async (req, res) => {
    await handler(req.body.url, res);
  });
};