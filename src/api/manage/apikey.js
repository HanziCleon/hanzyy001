import fs from "fs"
import path from "path"

export default (app) => {
  
  // ADD API KEY
  app.post("/manage/apikey/add", async (req, res) => {
    try {
      const { key, name, category, ratelimit, admin_key } = req.body
      
      if (admin_key !== "hanzyy001") {
        return res.status(403).json({
          status: false,
          error: "Unauthorized",
          message: "Invalid admin key"
        })
      }
      
      if (!key || !name || !category || !ratelimit) {
        return res.status(400).json({
          status: false,
          error: "Missing required fields",
          message: "key, name, category, and ratelimit are required"
        })
      }
      
      const settingsPath = path.join(process.cwd(), "src", "settings.json")
      const settings = JSON.parse(fs.readFileSync(settingsPath, "utf-8"))
      
      if (!settings.apiKeys) {
        settings.apiKeys = []
      }
      
      if (!settings.apiSettings.apikey) {
        settings.apiSettings.apikey = {}
      }
      
      if (settings.apiKeys.some(k => k.key === key) || settings.apiSettings.apikey[key]) {
        return res.status(409).json({
          status: false,
          error: "API key already exists",
          message: `API key ${key} already exists`
        })
      }
      
      settings.apiKeys.push({
        key: key,
        name: name,
        category: category,
        ratelimit: ratelimit,
        active: true,
        createdAt: new Date().toISOString()
      })
      
      settings.apiSettings.apikey[key] = {
        rateLimit: ratelimit,
        enabled: true,
        category: category,
        name: name
      }
      
      fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2))
      
      res.status(201).json({
        status: true,
        message: "API key added successfully",
        data: {
          key: key,
          name: name,
          category: category,
          ratelimit: ratelimit
        }
      })
      
    } catch (error) {
      console.error("Error adding API key:", error)
      res.status(500).json({
        status: false,
        error: error.message || "Internal server error"
      })
    }
  })
  
  // DELETE API KEY
  app.delete("/manage/apikey/delete", async (req, res) => {
    try {
      const { key, admin_key } = req.body
      
      if (admin_key !== "hanzyy001") {
        return res.status(403).json({
          status: false,
          error: "Unauthorized",
          message: "Invalid admin key"
        })
      }
      
      if (!key) {
        return res.status(400).json({
          status: false,
          error: "Missing required field",
          message: "key is required"
        })
      }
      
      const settingsPath = path.join(process.cwd(), "src", "settings.json")
      const settings = JSON.parse(fs.readFileSync(settingsPath, "utf-8"))
      
      const keyIndex = settings.apiKeys.findIndex(k => k.key === key)
      
      if (keyIndex === -1 && !settings.apiSettings.apikey[key]) {
        return res.status(404).json({
          status: false,
          error: "API key not found",
          message: `API key ${key} not found`
        })
      }
      
      let deletedKey = null
      if (keyIndex !== -1) {
        deletedKey = settings.apiKeys.splice(keyIndex, 1)[0]
      }
      
      if (settings.apiSettings.apikey[key]) {
        if (!deletedKey) {
          deletedKey = {
            name: settings.apiSettings.apikey[key].name || 'Unknown',
            key: key
          }
        }
        delete settings.apiSettings.apikey[key]
      }
      
      fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2))
      
      res.status(200).json({
        status: true,
        message: "API key deleted successfully",
        data: {
          key: deletedKey.key,
          name: deletedKey.name
        }
      })
      
    } catch (error) {
      console.error("Error deleting API key:", error)
      res.status(500).json({
        status: false,
        error: error.message || "Internal server error"
      })
    }
  })
  
  // LIST ALL API KEYS
  app.get("/manage/apikey/list", async (req, res) => {
    try {
      const { admin_key } = req.query
      
      if (admin_key !== "hanzyy001") {
        return res.status(403).json({
          status: false,
          error: "Unauthorized",
          message: "Invalid admin key"
        })
      }
      
      const settingsPath = path.join(process.cwd(), "src", "settings.json")
      const settings = JSON.parse(fs.readFileSync(settingsPath, "utf-8"))
      
      const allApiKeys = []
      
      if (settings.apiKeys) {
        settings.apiKeys.forEach(apiKey => {
          allApiKeys.push({
            ...apiKey,
            source: 'array'
          })
        })
      }
      
      if (settings.apiSettings && settings.apiSettings.apikey) {
        Object.entries(settings.apiSettings.apikey).forEach(([key, config]) => {
          if (!settings.apiKeys || !settings.apiKeys.some(k => k.key === key)) {
            allApiKeys.push({
              key: key,
              name: config.name || 'Default Key',
              category: config.category || 'default',
              ratelimit: config.rateLimit || 'unlimited',
              active: config.enabled !== false,
              createdAt: 'Default',
              source: 'default'
            })
          }
        })
      }
      
      res.status(200).json({
        status: true,
        message: "API keys listed successfully",
        total: allApiKeys.length,
        data: allApiKeys
      })
      
    } catch (error) {
      console.error("Error listing API keys:", error)
      res.status(500).json({
        status: false,
        error: error.message || "Internal server error"
      })
    }
  })
  
  // TOGGLE API KEY REQUIREMENT
  app.put("/manage/apikey/toggle", async (req, res) => {
    try {
      const { action, admin_key } = req.body
      
      if (admin_key !== "hanzyy001") {
        return res.status(403).json({
          status: false,
          error: "Unauthorized",
          message: "Invalid admin key"
        })
      }
      
      if (!action || (action !== 'enable' && action !== 'disable')) {
        return res.status(400).json({
          status: false,
          error: "Invalid action",
          message: "action must be 'enable' or 'disable'"
        })
      }
      
      const settingsPath = path.join(process.cwd(), "src", "settings.json")
      const settings = JSON.parse(fs.readFileSync(settingsPath, "utf-8"))
      
      settings.apiSettings.requireApikey = action === 'enable'
      
      fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2))
      
      res.status(200).json({
        status: true,
        message: `API key requirement ${action === 'enable' ? 'enabled' : 'disabled'} successfully`,
        data: {
          requireApikey: settings.apiSettings.requireApikey
        }
      })
      
    } catch (error) {
      console.error("Error toggling API key requirement:", error)
      res.status(500).json({
        status: false,
        error: error.message || "Internal server error"
      })
    }
  })
  
  // UPDATE API KEY
  app.put("/manage/apikey/update", async (req, res) => {
    try {
      const { key, new_name, new_category, new_ratelimit, admin_key } = req.body
      
      if (admin_key !== "hanzyy001") {
        return res.status(403).json({
          status: false,
          error: "Unauthorized",
          message: "Invalid admin key"
        })
      }
      
      if (!key) {
        return res.status(400).json({
          status: false,
          error: "Missing required field",
          message: "key is required"
        })
      }
      
      const settingsPath = path.join(process.cwd(), "src", "settings.json")
      const settings = JSON.parse(fs.readFileSync(settingsPath, "utf-8"))
      
      const keyIndex = settings.apiKeys.findIndex(k => k.key === key)
      
      if (keyIndex === -1 && !settings.apiSettings.apikey[key]) {
        return res.status(404).json({
          status: false,
          error: "API key not found",
          message: `API key ${key} not found`
        })
      }
      
      if (keyIndex !== -1) {
        if (new_name) settings.apiKeys[keyIndex].name = new_name
        if (new_category) settings.apiKeys[keyIndex].category = new_category
        if (new_ratelimit) settings.apiKeys[keyIndex].ratelimit = new_ratelimit
      }
      
      if (settings.apiSettings.apikey[key]) {
        if (new_name) settings.apiSettings.apikey[key].name = new_name
        if (new_category) settings.apiSettings.apikey[key].category = new_category
        if (new_ratelimit) settings.apiSettings.apikey[key].rateLimit = new_ratelimit
      }
      
      fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2))
      
      res.status(200).json({
        status: true,
        message: "API key updated successfully",
        data: {
          key: key,
          name: new_name || settings.apiKeys[keyIndex]?.name,
          category: new_category || settings.apiKeys[keyIndex]?.category,
          ratelimit: new_ratelimit || settings.apiKeys[keyIndex]?.ratelimit
        }
      })
      
    } catch (error) {
      console.error("Error updating API key:", error)
      res.status(500).json({
        status: false,
        error: error.message || "Internal server error"
      })
    }
  })
  
}