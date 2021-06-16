/*
  Helpers for various tasks
*/

// Dependencies
import * as crypto from 'crypto'
import config from './config.mjs'
// Container for all the helpers
let helpers = {}

// Create a SHA256 hash
helpers.hash = (str) => {
  if (typeof str === 'string' && str.length) {
    const hash = crypto
      .createHmac('sha256', config.hashingSecret)
      .update(str)
      .digest('hex')
    return hash
  } else return false
}

// Parse a JSON string to an object in all cases, without throwing
helpers.parseJsonToObject = (str) => {
  try {
    const obj = JSON.parse(str)
    return obj
  } catch (err) {
    return {}
  }
}

export default helpers
