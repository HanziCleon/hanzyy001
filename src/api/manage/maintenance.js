import fs from "fs"
import path from "path"

export default (app) => {
  
  // TOGGLE MAINTENANCE MODE
  app.put("/manage/maintenance", async (req, res) => {
    try {
      const { action, message, admin_key } = req.body
      
      if (admin_key !== "hanzyy001") {
        return res.status(403).json({
          status: false,
          error: "Unauthorized",
          message: "Invalid admin key"
        })
      }
      
      if (!action || (action !== 'on' && action !== 'off')) {
        return res.status(400).json({
          status: false,
          error: "Invalid action",
          message: "action must be 'on' or 'off'"
        })
      }
      
      const settingsPath = path.join(process.cwd(), "src", "settings.json")
      const settings = JSON.parse(fs.readFileSync(settingsPath, "utf-8"))
      
      if (!settings.maintenance) {
        settings.maintenance = {}
      }
      
      settings.maintenance.enabled = action === 'on'
      settings.maintenance.message = action === 'on' 
        ? (message || 'API is currently under maintenance. Please try again later.')
        : ''
      
      fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2))
      
      res.status(200).json({
        status: true,
        message: `Maintenance mode ${action === 'on' ? 'enabled' : 'disabled'} successfully`,
        data: {
          enabled: settings.maintenance.enabled,
          message: settings.maintenance.message
        }
      })
      
    } catch (error) {
      console.error("Error toggling maintenance mode:", error)
      res.status(500).json({
        status: false,
        error: error.message || "Internal server error"
      })
    }
  })
  
  // GET MAINTENANCE STATUS
  app.get("/manage/maintenance/status", async (req, res) => {
    try {
      const settingsPath = path.join(process.cwd(), "src", "settings.json")
      const settings = JSON.parse(fs.readFileSync(settingsPath, "utf-8"))
      
      res.status(200).json({
        status: true,
        message: "Maintenance status retrieved successfully",
        data: {
          enabled: settings.maintenance?.enabled || false,
          message: settings.maintenance?.message || ''
        }
      })
      
    } catch (error) {
      console.error("Error getting maintenance status:", error)
      res.status(500).json({
        status: false,
        error: error.message || "Internal server error"
      })
    }
  })
  
}