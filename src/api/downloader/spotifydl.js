import axios from "axios"
import fs from "fs"
import path from "path"

const headers = {
  "User-Agent":
    "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Mobile Safari/537.36",
}

/**
 * Get Spotify track or playlist info from Spotisaver
 */
export async function spotifyInfo(url) {
  try {
    if (!url) throw new Error("Spotify URL is required")
    let id, type, referer

    if (url.includes("/track/")) {
      id = url.split("/track/")[1]?.split("?")[0]
      type = "track"
      referer = `https://spotisaver.net/en/track/${id}/`
    } else if (url.includes("/playlist/")) {
      id = url.split("/playlist/")[1]?.split("?")[0]
      type = "playlist"
      referer = `https://spotisaver.net/en/playlist/${id}/`
    } else {
      throw new Error("Invalid Spotify URL")
    }

    const apiUrl = `https://spotisaver.net/api/get_playlist.php?id=${id}&type=${type}&lang=en`
    const { data } = await axios.get(apiUrl, { headers: { ...headers, Referer: referer } })

    if (!data?.tracks || !Array.isArray(data.tracks)) throw new Error("No tracks found")

    return {
      id,
      type,
      total: data.tracks.length,
      tracks: data.tracks.map((t) => ({
        id: t.id,
        title: t.title,
        artist: t.artist,
        duration: t.duration,
        cover: t.cover,
        mp3_preview: t.preview_url,
      })),
    }
  } catch (err) {
    throw new Error(err.message)
  }
}

/**
 * Download a Spotify track from Spotisaver
 */
export async function spotifyDownload(trackId) {
  try {
    if (!trackId) throw new Error("Track ID is required")

    const payload = {
      track: { id: trackId },
      download_dir: "downloads",
      filename_tag: "SPOTISAVER",
      user_ip: "2404:c0:9830::800e:2a9c",
      is_premium: false,
    }

    const { data } = await axios.post("https://spotisaver.net/api/download_track.php", payload, {
      headers: { ...headers, Referer: `https://spotisaver.net/en/track/${trackId}/` },
      responseType: "arraybuffer",
    })

    const filePath = path.resolve("downloads", `${trackId}.mp3`)
    fs.writeFileSync(filePath, data)
    return filePath
  } catch (err) {
    throw new Error(err.message)
  }
}
