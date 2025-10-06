import axios from "axios"
import { v4 as uuidv4 } from "uuid"
import { createApiKeyMiddleware } from "../../middleware/apikey.js"

class Zai {
  #models = {
    "glm-4.5": "0727-360B-API",
    "glm-4.5-air": "0727-106B-API",
    "glm-4-32b": "main_chat",
    "glm-4.1v-9b-thinking": "GLM-4.1V-Thinking-FlashX",
    "z1-rumination": "deep-research",
    "z1-32b": "zero",
    "glm-4-flash": "glm-4-flash"
  }

  async chat(question, { model = "glm-4.5", system_prompt = null, search = false } = {}) {
    if (!question) throw new Error("Question is required")
    if (!this.#models[model]) throw new Error(`Available models: ${Object.keys(this.#models).join(", ")}`)
    if (typeof search !== "boolean") throw new Error("Search must be a boolean")

    const auth = await axios.get("https://chat.z.ai/api/v1/auths/")
    const { data } = await axios.post("https://chat.z.ai/api/chat/completions", {
      messages: [
        ...(system_prompt ? [{ role: "system", content: system_prompt }] : []),
        { role: "user", content: question }
      ],
      ...(search ? { mcp_servers: ["deep-web-search"] } : {}),
      model: this.#models[model],
      chat_id: "local",
      id: uuidv4(),
      stream: true
    }, {
      headers: {
        authorization: `Bearer ${auth.data.token}`,
        cookie: auth.headers["set-cookie"]?.join("; ") || "",
        "x-fe-version": "prod-fe-1.0.52"
      }
    })

    return data
      .split("\n\n")
      .filter(line => line.startsWith("data:"))
      .map(line => JSON.parse(line.substring(6)))
      .filter(line => line?.data?.phase !== "thinking")
      .map(line => line?.data?.delta_content)
      .join("")
  }
}

const zai = new Zai()

export default (app) => {
  app.all("/ai/zai", createApiKeyMiddleware(), async (req, res) => {
    try {
      const { question, model, system_prompt, search } = req.query.question ? req.query : req.body
      if (!question)
        return res.status(400).json({
          status: false,
          code: 400,
          result: { message: "Missing 'question' parameter" }
        })

      const result = await zai.chat(question, {
        model: model || "glm-4.5",
        system_prompt,
        search: search === "true"
      })

      res.status(200).json({
        status: true,
        code: 200,
        result: { text: result }
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
