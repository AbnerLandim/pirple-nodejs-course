/*
* Primary file for the API
*
*/

// Dependencies
import * as http from 'http'
import * as url from 'url'
import { StringDecoder } from 'string_decoder'
import config from './config.mjs'

// The server should responde to all requests with a string
const PORT = config.port
const server = http.createServer((req, res) => {
  
  // Get the URL and parse it
  const parsedUrl = url.parse(req.url, true)
  // Get the path
  const path = parsedUrl.pathname
  const trimmedPath = path.replace(/^\/+|\/+$/g,'')

  // Get the query string as an object
  const queryStringObject = JSON.stringify(parsedUrl.query)

  // Get the HTTP Method
  const method = req.method.toLowerCase()

  // Get the headers as an object
  const headers = JSON.stringify(req.headers)

  // Get the payload, if any
  const decoder = new StringDecoder('utf-8')
  let buffer = ''
  req.on('data', data => {
    buffer += decoder.write(data)
  })
  req.on('end', () => {
    buffer += decoder.end()

    // Choose the handler this request should go to. If one is not found, use the notFound handler
    const chosenHandler = router[trimmedPath] ?? handlers.notFound

    // Construct the data object to send to the handler
    const data = {
      trimmedPath,
      queryStringObject,
      method,
      headers,
      payload: buffer
    }

    // Route the request to the handler specified in the router
    chosenHandler(data, (statusCode, payload) => {
      // Use the status code called back by the handler, or default to 200
      statusCode = typeof statusCode === 'number' ? statusCode : 200
      
      // Use the payload called back by the handler, or default to an empty object
      payload = typeof payload === 'object' ? payload : {}

      // Convert the payload to a string
      const payloadString = JSON.stringify(payload)

      // Return the response
      res.setHeader('Content-Type', 'application/json')
      res.writeHead(statusCode)
      res.end(payloadString)
      console.log(`Status: ${statusCode} with response: ${payloadString}.`)
    })
  })
})

// Start the serve, and have it listen on port 3000
server.listen(PORT, () => {
  console.log(`ENV: ${config.envName} - the server is listening on port ${PORT} now`)
})

// Define the handlers
let handlers = {}

// Sample handler
handlers.sample = (data, callback) => {
  // Callback a http status code, and a payload object
  callback(406, {"name": "sample handler"})
}

// Not found handler
handlers.notFound = (data, callback) => {
  callback(404)
}

// Define a request router
const router = {
  'sample': handlers.sample
}