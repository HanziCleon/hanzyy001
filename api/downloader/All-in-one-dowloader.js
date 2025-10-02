// d-savefrom.js
import puppeteer from "puppeteer-extra";
import StealthPlugin from "puppeteer-extra-plugin-stealth";
import * as cheerio from "cheerio";
import { createApiKeyMiddleware } from "../../middleware/apikey.js";
import chromium from "@sparticuz/chromium";

puppeteer.use(StealthPlugin());

class SaveFromDownloader {
  constructor() {
    this.targetUrl = "https://id.savefrom.net/251le/";
    this.browser = null;
    this.page = null;
  }

  async init() {
    this.browser = await puppeteer.launch({
      args: [
        ...chromium.args,
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage",
        "--disable-accelerated-2d-canvas",
        "--no-first-run",
        "--no-zygote",
        "--disable-gpu"
      ],
      defaultViewport: chromium.defaultViewport,
      executablePath: await chromium.executablePath,
      headless: chromium.headless
    });
    this.page = await this.browser.newPage();
  }

  async download(url) {
    if (!this.browser) await this.init();

    try {
      await this.page.goto(this.targetUrl, { waitUntil: "domcontentloaded" });
      await this.page.type("#sf_url", url);
      await this.page.click("#sf_submit");

      await this.page.waitForResponse((res) => res.url().includes("savefrom.php"), { timeout: 15000 });
      await this.page.waitForSelector("#sf_result .media-result", { timeout: 30000 });

      const html = await this.page.content();
      return {
        success: true,
        data: this.parseResult(html),
        url
      };
    } catch (e) {
      return { success: false, error: e.message, data: [], url };
    }
  }

  parseResult(html) {
    const $ = cheerio.load(html);
    const results = [];

    $("#sf_result .result-box").each((i, el) => {
      const $el = $(el);
      const link = $el.find(".link-download").attr("href");

      if (!link) return;

      const dataType = $el.find(".link-download").attr("data-type") || "";
      const buttonText = $el.find(".link-download").text().trim();
      const urlExtension = link.split(".").pop()?.split("?")[0].toLowerCase() || "";
      const htmlClass = $el.attr("class") || "";

      let format =
        dataType ||
        buttonText.match(/\b(MP3|JPEG|MP4|PNG|GIF|WAV|JPG)\b/i)?.[1]?.toLowerCase() ||
        urlExtension ||
        "unknown";

      let type = "unknown";
      if (htmlClass.includes("video") || ["mp4", "avi", "mov", "webm"].includes(format)) type = "video";
      else if (htmlClass.includes("audio") || ["mp3", "wav", "aac", "ogg"].includes(format)) type = "audio";
      else if (["jpeg", "jpg", "png", "gif", "webp"].includes(format)) type = "image";

      results.push({
        title: $el.find(".title").text().trim().replace(/^#+\s*/, "") || "untitled",
        platform: $el.attr("data-hid") || "unknown",
        type,
        format,
        url: link,
        thumb: $el.find(".thumb img").attr("src") || null,
        quality: $el.find(".link-download").attr("data-quality") || null
      });
    });

    return results;
  }

  async close() {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
      this.page = null;
    }
  }
}

async function scrapeDownload(videoUrl) {
  const downloader = new SaveFromDownloader();
  try {
    const result = await downloader.download(videoUrl);
    await downloader.close();
    return result;
  } catch (error) {
    await downloader.close();
    return { success: false, error: error.message, data: [], url: videoUrl };
  }
}

export default (app) => {
  const handler = async (inputUrl, type, res) => {
    if (!inputUrl || typeof inputUrl !== "string" || !inputUrl.trim()) {
      return res.status(400).json({ status: false, error: "URL parameter is required" });
    }

    const result = await scrapeDownload(inputUrl.trim());

    if (!result || !result.success) {
      return res.status(500).json({ status: false, error: result?.error || "Failed to download media data" });
    }

    let filtered = result.data;
    if (type && ["video", "audio", "image"].includes(type)) {
      filtered = filtered.filter((item) => item.type === type);
    }

    return res.status(200).json({
      status: true,
      data: filtered,
      count: filtered.length,
      url: result.url,
      timestamp: new Date().toISOString()
    });
  };

  // GET
  app.get("/api/d/savefrom", createApiKeyMiddleware(), async (req, res) => {
    await handler(req.query.url, req.query.type, res);
  });

  // POST
  app.post("/api/d/savefrom", createApiKeyMiddleware(), async (req, res) => {
    await handler(req.body.url, req.body.type, res);
  });
};