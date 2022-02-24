// Server related tasks

// Dependencies
import * as http from 'http'
import * as https from 'https'
import * as url from 'url'
import * as path from 'path'
import { StringDecoder } from 'string_decoder'
import * as fs from 'fs'
import config from './config.mjs'
import handlers from './handlers.mjs'
import helpers from './helpers.mjs'

const HTTP_PORT = config.httpPort
const HTTPS_PORT = config.httpsPort

// Instantiate the server module object
const server = {}

// Instantiate the HTTP server
server.httpServer = http.createServer((req, res) => {
  server.unifiedServer(req, res)
})

// Instatiate the HTTPS server
server.httpsServerOptions = {
  key: fs.readFileSync(path.join(path.resolve(), '/https/key.pem')),
  cert: fs.readFileSync(path.join(path.resolve(), '/https/cert.pem')),
}

server.httpsServer = https.createServer(
  server.httpsServerOptions,
  (req, res) => {
    unifiedServer(req, res)
  }
)

// All the server logic for both the http and https server
server.unifiedServer = function (req, res) {
  // Get the URL and parse it
  const parsedUrl = url.parse(req.url, true)

  // Get the path
  const path = parsedUrl.pathname
  const trimmedPath = path.replace(/^\/+|\/+$/g, '')

  // Get the query string as an object
  const queryStringObject = JSON.stringify(parsedUrl.query)

  // Get the HTTP Method
  const method = req.method.toLowerCase()

  // Get the headers as an object
  const headers = JSON.stringify(req.headers)

  // Get the payload, if any
  const decoder = new StringDecoder('utf-8')

  let buffer = ''
  req.on('data', (data) => {
    buffer += decoder.write(data)
  })

  req.on('end', () => {
    buffer += decoder.end()

    // Choose the handler this request should go to. If one is not found, use the notFound handler
    const chosenHandler =
      server.router[trimmedPath] !== undefined
        ? server.router[trimmedPath]
        : handlers.notFound

    // Construct the data object to send to the handler
    const data = {
      trimmedPath,
      queryStringObject,
      method,
      headers,
      payload: helpers.parseJsonToObject(buffer),
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
}

// Define a request router
server.router = {
  ping: handlers.ping,
  hello: handlers.hello,
  users: handlers.users,
  tokens: handlers.tokens,
  checks: handlers.checks,
}

// Init script
server.init = () => {
  // Start the HTTP server
  server.httpServer.listen(HTTP_PORT, () => {
    console.log(
      `ENV: ${config.envName} - the server is listening on port ${HTTP_PORT} now`
    )
  })

  // Start the HTTPS server
  server.httpsServer.listen(HTTPS_PORT, () => {
    console.log(
      `ENV: ${config.envName} - the server is listening on port ${HTTPS_PORT} now`
    )
  })
}

export default server
