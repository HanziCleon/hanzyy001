import axios from "axios"
import WebSocket from "ws"
import { createApiKeyMiddleware } from "../../middleware/apikey.js"

class Copilot {
  constructor() {
    this.conversationId = null
    this.models = {
      default: "chat",
      "think-deeper": "reasoning",
      "gpt-5": "smart"
    }
    this.headers = {
      origin: "https://copilot.microsoft.com",
      "user-agent": "Mozilla/5.0 (Linux; Android 15; SM-F958 Build/AP3A.240905.015) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.6723.86 Mobile Safari/537.36"
    }
  }

  async createConversation() {
    const { data } = await axios.post("https://copilot.microsoft.com/c/api/conversations", null, {
      headers: this.headers
    })
    this.conversationId = data.id
    return this.conversationId
  }

  async chat(message, { model = "default" } = {}) {
    if (!this.conversationId) await this.createConversation()
    if (!this.models[model]) throw new Error(`Available models: ${Object.keys(this.models).join(", ")}`)

    return new Promise((resolve, reject) => {
      const ws = new WebSocket(
        `wss://copilot.microsoft.com/c/api/chat?api-version=2&features=-,ncedge,edgepagecontext&setflight=-,ncedge,edgepagecontext&ncedge=1`,
        { headers: this.headers }
      )

      const response = { text: "", citations: [] }

      ws.on("open", () => {
        ws.send(JSON.stringify({
          event: "setOptions",
          supportedFeatures: ["partial-generated-images"],
          supportedCards: ["weather", "local", "image", "sports", "video", "ads", "finance", "recipe"]
        }))

        ws.send(JSON.stringify({
          event: "send",
          mode: this.models[model],
          conversationId: this.conversationId,
          content: [{ type: "text", text: message }],
          context: {}
        }))
      })

      ws.on("message", (chunk) => {
        try {
          const parsed = JSON.parse(chunk.toString())
          switch (parsed.event) {
            case "appendText":
              response.text += parsed.text || ""
              break
            case "citation":
              response.citations.push({
                title: parsed.title,
                icon: parsed.iconUrl,
                url: parsed.url
              })
              break
            case "done":
              resolve(response)
              ws.close()
              break
            case "error":
              reject(new Error(parsed.message))
              ws.close()
              break
          }
        } catch (err) {
          reject(err.message)
        }
      })

      ws.on("error", reject)
    })
  }
}

const copilot = new Copilot()

export default (app) => {
  app.all("/ai/copilot", createApiKeyMiddleware(), async (req, res) => {
    try {
      const { message, model } = req.query.message ? req.query : req.body
      if (!message)
        return res.status(400).json({
          status: false,
          code: 400,
          result: { message: "Missing 'message' parameter" }
        })

      const result = await copilot.chat(message, { model: model || "default" })
      res.status(200).json({
        status: true,
        code: 200,
        result
      })
    } catch (err) {
      res.status(500).json({
        status: false,
        code: 500,
        result: { message: err.message }
      })
    }
  })
}
