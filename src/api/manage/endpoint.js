import fs from "fs"
import path from "path"
import { fileURLToPath } from "url"

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

export default (app) => {
  
  // CREATE NEW ENDPOINT
  app.post("/manage/endpoint/create", async (req, res) => {
    try {
      const { name, filename, category, method, description, parameters, optional_parameters, admin_key } = req.body
      
      // Simple admin authentication
      if (admin_key !== "hanzyy001") {
        return res.status(403).json({
          status: false,
          error: "Unauthorized",
          message: "Invalid admin key"
        })
      }
      
      if (!name || !filename || !category || !method) {
        return res.status(400).json({
          status: false,
          error: "Missing required fields",
          message: "name, filename, category, and method are required"
        })
      }
      
      // Validate filename
      if (!/^[a-zA-Z0-9-_]+$/.test(filename)) {
        return res.status(400).json({
          status: false,
          error: "Invalid filename",
          message: "Only letters, numbers, hyphens, and underscores are allowed"
        })
      }
      
      const apiFolder = path.join(process.cwd(), "src", "api")
      const categoryFolder = path.join(apiFolder, category)
      const fileName = `${filename}.js`
      const filePath = path.join(categoryFolder, fileName)
      
      // Create category folder if not exists
      if (!fs.existsSync(categoryFolder)) {
        fs.mkdirSync(categoryFolder, { recursive: true })
      }
      
      // Check if file already exists
      if (fs.existsSync(filePath)) {
        return res.status(409).json({
          status: false,
          error: "Endpoint already exists",
          message: `Endpoint ${filename} already exists in category ${category}`
        })
      }
      
      // Generate endpoint code
      const endpointCode = generateEndpointTemplate(
        filename, 
        category, 
        method, 
        description || `API endpoint for ${name}`,
        parameters || "",
        optional_parameters || ""
      )
      
      // Write file
      fs.writeFileSync(filePath, endpointCode)
      
      // Update settings.json
      await updateSettingsWithEndpoint(
        name, 
        filename, 
        category, 
        method, 
        description || `API endpoint for ${name}`,
        parameters || "",
        optional_parameters || ""
      )
      
      res.status(201).json({
        status: true,
        message: "Endpoint created successfully",
        data: {
          name: name,
          filename: filename,
          category: category,
          method: method,
          path: `/${category}/${filename}`,
          file: `src/api/${category}/${fileName}`
        }
      })
      
    } catch (error) {
      console.error("Error creating endpoint:", error)
      res.status(500).json({
        status: false,
        error: error.message || "Internal server error"
      })
    }
  })
  
  // DELETE ENDPOINT
  app.delete("/manage/endpoint/delete", async (req, res) => {
    try {
      const { filename, category, admin_key } = req.body
      
      if (admin_key !== "your_admin_secret_key") {
        return res.status(403).json({
          status: false,
          error: "Unauthorized",
          message: "Invalid admin key"
        })
      }
      
      if (!filename || !category) {
        return res.status(400).json({
          status: false,
          error: "Missing required fields",
          message: "filename and category are required"
        })
      }
      
      const apiFolder = path.join(process.cwd(), "src", "api")
      const categoryFolder = path.join(apiFolder, category)
      const fileName = `${filename}.js`
      const filePath = path.join(categoryFolder, fileName)
      
      if (!fs.existsSync(filePath)) {
        return res.status(404).json({
          status: false,
          error: "Endpoint not found",
          message: `Endpoint ${filename} not found in category ${category}`
        })
      }
      
      // Delete file
      fs.unlinkSync(filePath)
      
      // Remove from settings.json
      await removeEndpointFromSettings(filename, category)
      
      res.status(200).json({
        status: true,
        message: "Endpoint deleted successfully",
        data: {
          filename: filename,
          category: category,
          path: `/${category}/${filename}`,
          file: `src/api/${category}/${fileName}`
        }
      })
      
    } catch (error) {
      console.error("Error deleting endpoint:", error)
      res.status(500).json({
        status: false,
        error: error.message || "Internal server error"
      })
    }
  })
  
  // LIST ALL ENDPOINTS
  app.get("/manage/endpoint/list", async (req, res) => {
    try {
      const apiFolder = path.join(process.cwd(), "src", "api")
      const endpoints = []
      
      if (fs.existsSync(apiFolder)) {
        const categories = fs.readdirSync(apiFolder)
        
        for (const category of categories) {
          const categoryPath = path.join(apiFolder, category)
          if (fs.statSync(categoryPath).isDirectory()) {
            const files = fs.readdirSync(categoryPath)
            const jsFiles = files.filter(file => file.endsWith('.js'))
            
            for (const file of jsFiles) {
              const endpointName = path.basename(file, '.js')
              endpoints.push({
                name: endpointName,
                category: category,
                path: `/${category}/${endpointName}`,
                file: `src/api/${category}/${file}`
              })
            }
          }
        }
      }
      
      res.status(200).json({
        status: true,
        message: "Endpoints listed successfully",
        total: endpoints.length,
        data: endpoints
      })
      
    } catch (error) {
      console.error("Error listing endpoints:", error)
      res.status(500).json({
        status: false,
        error: error.message || "Internal server error"
      })
    }
  })
  
  // SCAN FOLDER STRUCTURE
  app.get("/manage/endpoint/scan", async (req, res) => {
    try {
      const apiFolder = path.join(process.cwd(), "src", "api")
      const scanResults = []
      
      if (fs.existsSync(apiFolder)) {
        const categories = fs.readdirSync(apiFolder)
        
        for (const category of categories) {
          const categoryPath = path.join(apiFolder, category)
          if (fs.statSync(categoryPath).isDirectory()) {
            const files = fs.readdirSync(categoryPath)
            const jsFiles = files.filter(file => file.endsWith('.js'))
            
            scanResults.push({
              category: category,
              count: jsFiles.length,
              files: jsFiles
            })
          }
        }
      }
      
      res.status(200).json({
        status: true,
        message: "Folder structure scanned successfully",
        data: scanResults
      })
      
    } catch (error) {
      console.error("Error scanning endpoints:", error)
      res.status(500).json({
        status: false,
        error: error.message || "Internal server error"
      })
    }
  })
  
  // UPDATE ENDPOINT
  app.put("/manage/endpoint/update", async (req, res) => {
    try {
      const { filename, category, new_description, new_parameters, admin_key } = req.body
      
      if (admin_key !== "your_admin_secret_key") {
        return res.status(403).json({
          status: false,
          error: "Unauthorized",
          message: "Invalid admin key"
        })
      }
      
      if (!filename || !category) {
        return res.status(400).json({
          status: false,
          error: "Missing required fields",
          message: "filename and category are required"
        })
      }
      
      const settingsPath = path.join(process.cwd(), "src", "settings.json")
      const settings = JSON.parse(fs.readFileSync(settingsPath, "utf-8"))
      
      const categoryDisplayNames = {
        'ai': 'Artificial Intelligence',
        'maker': 'Image Makers',
        'random': 'Random',
        'tools': 'Tools',
        'search': 'Search',
        'social': 'Social',
        'downloader': 'Downloader',
        'custom': 'Custom'
      }
      
      const categoryDisplayName = categoryDisplayNames[category] || category.charAt(0).toUpperCase() + category.slice(1)
      const categoryIndex = settings.categories.findIndex(cat => cat.name === categoryDisplayName)
      
      if (categoryIndex !== -1) {
        const itemIndex = settings.categories[categoryIndex].items.findIndex(item => 
          item.path.includes(`/${category}/${filename}`)
        )
        
        if (itemIndex !== -1) {
          if (new_description) {
            settings.categories[categoryIndex].items[itemIndex].desc = new_description
          }
          
          if (new_parameters) {
            const paramObj = {}
            const paramList = new_parameters.split(',').map(p => p.trim())
            paramList.forEach(param => {
              paramObj[param] = `Description for ${param} parameter`
            })
            settings.categories[categoryIndex].items[itemIndex].params = paramObj
          }
          
          fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2))
          
          res.status(200).json({
            status: true,
            message: "Endpoint updated successfully",
            data: settings.categories[categoryIndex].items[itemIndex]
          })
        } else {
          res.status(404).json({
            status: false,
            error: "Endpoint not found in settings"
          })
        }
      } else {
        res.status(404).json({
          status: false,
          error: "Category not found in settings"
        })
      }
      
    } catch (error) {
      console.error("Error updating endpoint:", error)
      res.status(500).json({
        status: false,
        error: error.message || "Internal server error"
      })
    }
  })
  
}

function generateEndpointTemplate(name, category, method, description, parameters, optionalParameters) {
  const paramList = parameters ? parameters.split(',').map(p => p.trim()) : []
  const optionalParamList = optionalParameters ? optionalParameters.split(',').map(p => p.trim()) : []
  const allParamList = [...paramList, ...optionalParamList]
  
  const paramValidation = paramList.map(param => 
    `      if (!${param}) {
        return res.status(400).json({ 
          status: false, 
          error: "${param} is required" 
        })
      }`
  ).join('\n')
  
  const paramUsage = allParamList.map(param => 
    `      const ${param} = req.${method === 'GET' ? 'query' : 'body'}.${param}`
  ).join('\n')
  
  const paramExamples = paramList.map(param => {
    const examples = {
      'text': 'Hello World',
      'query': 'search term',
      'url': 'https://example.com',
      'limit': '10',
      'id': '123'
    }
    return examples[param.toLowerCase()] || `example_${param}`
  })
  
  return `import axios from "axios"
import { createApiKeyMiddleware } from "../../middleware/apikey.js"

export default (app) => {
  app.${method.toLowerCase()}("/${category}/${name}", createApiKeyMiddleware(), async (req, res) => {
    try {
${paramUsage}
      
${paramValidation}
      
      res.status(200).json({
        status: true,
        message: "${description}",
        endpoint: "/${category}/${name}",
        method: "${method}",
        required_parameters: {
          ${paramList.map((param, index) => `"${param}": "${paramExamples[index]}"`).join(',\n          ')}
        },
        ${optionalParamList.length > 0 ? `optional_parameters: {
          ${optionalParamList.map(param => `"${param}": "example_${param}"`).join(',\n          ')}
        },` : ''}
        example: {
          url: "https://your-domain.com/${category}/${name}${allParamList.length > 0 ? '?' + allParamList.map(p => `${p}=${paramList.includes(p) ? paramExamples[paramList.indexOf(p)] : `example_${p}`}`).join('&') : '"}",
          method: "${method}",
          ${method === 'GET' ? 'query' : 'body'}: {
            ${allParamList.map((param, index) => `"${param}": "${paramList.includes(param) ? paramExamples[paramList.indexOf(param)] : `example_${param}`}"`).join(',\n            ')}
          }
        }
      })
      
    } catch (error) {
      console.error("${category}/${name} API Error:", error)
      res.status(500).json({ 
        status: false, 
        error: error.message || "Internal server error" 
      })
    }
  })
}`
}

async function updateSettingsWithEndpoint(name, filename, category, method, description, parameters, optionalParameters) {
  try {
    const settingsPath = path.join(process.cwd(), "src", "settings.json")
    const settings = JSON.parse(fs.readFileSync(settingsPath, "utf-8"))
    
    const categoryDisplayNames = {
        'ai': 'Artificial Intelligence',
        'maker': 'Image Makers',
        'random': 'Random',
        'tools': 'Tools',
        'search': 'Search',
        'social': 'Social',
        'downloader': 'Downloader',
        'custom': 'Custom'
    }
    
    const categoryDisplayName = categoryDisplayNames[category] || category.charAt(0).toUpperCase() + category.slice(1)
    
    const paramObj = {}
    if (parameters) {
      const paramList = parameters.split(',').map(p => p.trim())
      paramList.forEach(param => {
        paramObj[param] = `Required: Description for ${param} parameter`
      })
    }
    
    if (optionalParameters) {
      const optionalParamList = optionalParameters.split(',').map(p => p.trim())
      optionalParamList.forEach(param => {
        paramObj[param] = `Optional: Description for ${param} parameter`
      })
    }
    
    const allParams = []
    if (parameters) allParams.push(...parameters.split(',').map(p => p.trim() + '='))
    if (optionalParameters) allParams.push(...optionalParameters.split(',').map(p => p.trim() + '='))
    const endpointPath = `/${category}/${filename}${allParams.length > 0 ? '?' + allParams.join('&') : ''}`
    
    let categoryIndex = settings.categories.findIndex(cat => cat.name === categoryDisplayName)
    if (categoryIndex === -1) {
      settings.categories.push({
        name: categoryDisplayName,
        items: []
      })
      categoryIndex = settings.categories.length - 1
    }
    
    settings.categories[categoryIndex].items.push({
      name: name,
      desc: description,
      path: endpointPath,
      status: "ready",
      params: paramObj
    })
    
    fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2))
    
  } catch (error) {
    console.error('Error updating settings.json:', error)
    throw error
  }
}

async function removeEndpointFromSettings(filename, category) {
  try {
    const settingsPath = path.join(process.cwd(), "src", "settings.json")
    const settings = JSON.parse(fs.readFileSync(settingsPath, "utf-8"))
    
    const categoryDisplayNames = {
        'ai': 'Artificial Intelligence',
        'maker': 'Image Makers',
        'random': 'Random',
        'tools': 'Tools',
        'search': 'Search',
        'social': 'Social',
        'downloader': 'Downloader',
        'custom': 'Custom'
    }
    
    const categoryDisplayName = categoryDisplayNames[category] || category.charAt(0).toUpperCase() + category.slice(1)
    
    const categoryIndex = settings.categories.findIndex(cat => cat.name === categoryDisplayName)
    if (categoryIndex !== -1) {
      const itemIndex = settings.categories[categoryIndex].items.findIndex(item => 
        item.path.includes(`/${category}/${filename}`)
      )
      if (itemIndex !== -1) {
        settings.categories[categoryIndex].items.splice(itemIndex, 1)
        
        if (settings.categories[categoryIndex].items.length === 0) {
          settings.categories.splice(categoryIndex, 1)
        }
      }
    }
    
    fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2))
    
  } catch (error) {
    console.error('Error removing endpoint from settings.json:', error)
    throw error
  }
}