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

// Create a string of random alphanumeric characters of a given length
helpers.createRandomString = (strLength) => {
  strLength = typeof strLength === 'number' && !!strLength ? strLength : false
  if (strLength) {
    // Define all the possible characters that could go into the string
    const possibleCharacters = 'abcdefghijklmnopqrstuvwxyz0123456789'

    // Start the final string
    let str = ''

    for (let i = 1; i <= strLength; i++) {
      // Get a random character from the possibleCharacters string
      const randomCharacter = possibleCharacters.charAt(
        Math.floor(Math.random() * possibleCharacters.length)
      )
      // Append this character to the final string
      str += randomCharacter
    }
    return str
  } else {
    return false
  }
}

export default helpers
