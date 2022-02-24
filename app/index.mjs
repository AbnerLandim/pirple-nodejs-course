/*
 * Primary file for the API
 *
 */

// Dependencies
import server from './lib/server.mjs'
import workers from './lib/workers.mjs'

// Declare the app
const app = {}

// Init function
app.init = () => {
  server.init()
  workers.init()
}

app.init()

export default app
