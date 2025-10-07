import fs from "fs"
import path from "path"

let statsData = {
  totalRequests: 0,
  requestsByTime: new Map(),
  requestsByEndpoint: new Map(),
  startTime: Date.now(),
  lastReset: Date.now()
}

export function updateStats(endpoint = 'unknown') {
  statsData.totalRequests++
  const now = Date.now()
  const timeKey = Math.floor(now / 60000)
  
  if (!statsData.requestsByTime.has(timeKey)) {
    statsData.requestsByTime.set(timeKey, 0)
  }
  statsData.requestsByTime.set(timeKey, statsData.requestsByTime.get(timeKey) + 1)
  
  if (!statsData.requestsByEndpoint.has(endpoint)) {
    statsData.requestsByEndpoint.set(endpoint, 0)
  }
  statsData.requestsByEndpoint.set(endpoint, statsData.requestsByEndpoint.get(endpoint) + 1)
}

function getTimeRange(timeStr) {
  const now = Date.now()
  let startTime = now
  
  switch (timeStr) {
    case '5m':
      startTime = now - (5 * 60 * 1000)
      break
    case '15m':
      startTime = now - (15 * 60 * 1000)
      break
    case '30m':
      startTime = now - (30 * 60 * 1000)
      break
    case '1h':
      startTime = now - (60 * 60 * 1000)
      break
    case '6h':
      startTime = now - (6 * 60 * 60 * 1000)
      break
    case '12h':
      startTime = now - (12 * 60 * 60 * 1000)
      break
    case '1d':
      startTime = now - (24 * 60 * 60 * 1000)
      break
    case '3d':
      startTime = now - (3 * 24 * 60 * 60 * 1000)
      break
    case '7d':
      startTime = now - (7 * 24 * 60 * 60 * 1000)
      break
    default:
      startTime = now - (30 * 60 * 1000)
  }
  
  return { startTime, endTime: now }
}

export default (app) => {
  
  // GET STATS
  app.get("/manage/stats", async (req, res) => {
    try {
      const timeStr = req.query.time || '30m'
      const { startTime, endTime } = getTimeRange(timeStr)
      
      const uptime = Math.floor((Date.now() - statsData.startTime) / 1000)
      const uptimeStr = `${Math.floor(uptime / 3600)}h ${Math.floor((uptime % 3600) / 60)}m ${uptime % 60}s`
      
      let requestsInPeriod = 0
      const startMinute = Math.floor(startTime / 60000)
      const endMinute = Math.floor(endTime / 60000)
      
      for (let minute = startMinute; minute <= endMinute; minute++) {
        if (statsData.requestsByTime.has(minute)) {
          requestsInPeriod += statsData.requestsByTime.get(minute)
        }
      }
      
      const memoryUsage = Math.round(process.memoryUsage().heapUsed / 1024 / 1024)
      const cpuUsage = process.cpuUsage()
      
      const topEndpoints = Array.from(statsData.requestsByEndpoint.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10)
        .map(([endpoint, count]) => ({ endpoint, count }))
      
      res.status(200).json({
        status: true,
        message: "Stats retrieved successfully",
        data: {
          server: {
            status: "online",
            uptime: uptimeStr,
            uptimeSeconds: uptime,
            memoryUsage: `${memoryUsage} MB`,
            cpuUsage: `${Math.round(cpuUsage.user / 1000000)}ms`,
            startTime: new Date(statsData.startTime).toISOString()
          },
          requests: {
            total: statsData.totalRequests,
            inPeriod: requestsInPeriod,
            period: timeStr
          },
          topEndpoints: topEndpoints
        }
      })
      
    } catch (error) {
      console.error("Error getting stats:", error)
      res.status(500).json({
        status: false,
        error: error.message || "Internal server error"
      })
    }
  })
  
  // RESET STATS
  app.post("/manage/stats/reset", async (req, res) => {
    try {
      const { admin_key } = req.body
      
      if (admin_key !== "hanzyy001") {
        return res.status(403).json({
          status: false,
          error: "Unauthorized",
          message: "Invalid admin key"
        })
      }
      
      const oldTotal = statsData.totalRequests
      
      statsData = {
        totalRequests: 0,
        requestsByTime: new Map(),
        requestsByEndpoint: new Map(),
        startTime: Date.now(),
        lastReset: Date.now()
      }
      
      res.status(200).json({
        status: true,
        message: "Stats reset successfully",
        data: {
          previousTotal: oldTotal,
          resetAt: new Date().toISOString()
        }
      })
      
    } catch (error) {
      console.error("Error resetting stats:", error)
      res.status(500).json({
        status: false,
        error: error.message || "Internal server error"
      })
    }
  })
  
  // GET DETAILED STATS
  app.get("/manage/stats/detailed", async (req, res) => {
    try {
      const { admin_key } = req.query
      
      if (admin_key !== "hanzyy001") {
        return res.status(403).json({
          status: false,
          error: "Unauthorized",
          message: "Invalid admin key"
        })
      }
      
      const allEndpoints = Array.from(statsData.requestsByEndpoint.entries())
        .map(([endpoint, count]) => ({ endpoint, count }))
        .sort((a, b) => b.count - a.count)
      
      const timeDistribution = []
      const now = Date.now()
      for (let i = 0; i < 60; i++) {
        const timeKey = Math.floor((now - (i * 60000)) / 60000)
        const count = statsData.requestsByTime.get(timeKey) || 0
        timeDistribution.unshift({
          time: new Date(timeKey * 60000).toISOString(),
          count: count
        })
      }
      
      res.status(200).json({
        status: true,
        message: "Detailed stats retrieved successfully",
        data: {
          totalRequests: statsData.totalRequests,
          startTime: new Date(statsData.startTime).toISOString(),
          lastReset: new Date(statsData.lastReset).toISOString(),
          endpointStats: allEndpoints,
          timeDistribution: timeDistribution
        }
      })
      
    } catch (error) {
      console.error("Error getting detailed stats:", error)
      res.status(500).json({
        status: false,
        error: error.message || "Internal server error"
      })
    }
  })
  
}