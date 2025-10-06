import axios from "axios";
import { createApiKeyMiddleware } from "../../middleware/apikey.js";

// Mengambil fungsi utility dari kode scraper Anda
async function getSpotifyInfo(url) {
  let id, type, referer;
  const headers = {
    "User-Agent": "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Mobile Safari/537.36"
  };

  if (url.includes("/track/")) {
    id = url.split("/track/")[1]?.split("?")[0];
    type = "track";
    referer = `https://spotisaver.net/en/track/${id}/`;
  } else if (url.includes("/playlist/")) {
    id = url.split("/playlist/")[1]?.split("?")[0];
    type = "playlist";
    referer = `https://spotisaver.net/en/playlist/${id}/`;
  } else {
    throw new Error("URL Spotify tidak valid");
  }

  const apiUrl = `https://spotisaver.net/api/get_playlist.php?id=${id}&type=${type}&lang=en`;
  const res = await axios.get(apiUrl, { headers: { ...headers, Referer: referer } });
  
  if (type === "playlist") {
    return { type: "playlist", id, info: res.data?.playlist || {}, tracks: res.data?.tracks || [] };
  }
  // Untuk 'track', Spotisaver mereturn array tracks, kita ambil yang pertama
  return { type: "track", id, info: res.data?.tracks?.[0] || {} };
}


class SpotifyDownloader {
  async download({ url }) {
    if (!url) {
      return {
        status: false,
        code: 400,
        result: { message: "URL parameter is required" },
      };
    }

    try {
      const data = await getSpotifyInfo(url);
      
      if (data.type === "track") {
        const track = data.info;
        if (!track.id) {
            return {
                status: false,
                code: 404,
                result: { message: "Track not found or failed to fetch info" }
            };
        }
        
        // Membangun URL untuk potensi download langsung. 
        // Perlu dicatat: kode asli 'downloadTrack' mengembalikan Buffer, 
        // jadi klien API harus diinstruksikan untuk menggunakan data dari 
        // Spotisaver untuk mencoba download jika API tidak menyediakannya langsung.
        // Untuk tujuan demonstrasi, saya akan memberikan metadata yang lengkap.
        return {
          status: true,
          code: 200,
          result: {
            type: "track",
            id: track.id,
            title: track.title,
            artists: track.artists,
            album: track.album,
            preview_url: track.preview_url || null, // URL preview jika ada
            // Informasi tambahan untuk API client: klien harus menggunakan 
            // `id`, `title`, dan `artists` untuk mencoba mengunduh dari sumber lain 
            // atau API download terpisah.
            download_info: {
                message: "Download requires a secondary process using the track data."
            }
          }
        };
      } else if (data.type === "playlist") {
        const playlist = data.info;
        return {
          status: true,
          code: 200,
          result: {
            type: "playlist",
            id: data.id,
            title: playlist.title || "Playlist Title",
            creator: playlist.creator || "Unknown",
            tracks_count: data.tracks.length,
            tracks: data.tracks.map(track => ({
                id: track.id,
                title: track.title,
                artists: track.artists,
                album: track.album,
                preview_url: track.preview_url || null,
            }))
          }
        };
      }

      throw new Error("Gagal memproses URL Spotify.");

    } catch (err) {
      const message = err.message || "Server error";
      const code = message.includes("tidak valid") ? 400 : 500;
      return {
        status: false,
        code,
        result: { message: message }
      };
    }
  }
}

const spotifyDownloader = new SpotifyDownloader();

export default (app) => {
  const endpointPath = "/downloader/spotify";
  
  // Endpoint GET
  app.get(endpointPath, createApiKeyMiddleware(), async (req, res) => {
    const { url } = req.query;
    const result = await spotifyDownloader.download({ url });
    res.status(result.code).json(result);
  });

  // Endpoint POST
  app.post(endpointPath, createApiKeyMiddleware(), async (req, res) => {
    const { url } = req.body;
    const result = await spotifyDownloader.download({ url });
    res.status(result.code).json(result);
  });
};