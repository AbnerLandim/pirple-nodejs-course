/*
 * Worker-related tasks
 */

// Dependencies
import * as path from 'path'
import * as fs from 'fs'
import * as http from 'http'
import * as https from 'https'
import * as url from 'url'
import _data from './data.mjs'
import helpers from './helpers.mjs'

// Instantiate the worker object
const workers = {}

// Lookup all checks, get their data, send to a validator
workers.gatherAllChecks = () => {
  // Get all the checks
  _data.list('checks', (err, checks) => {
    if (!err && checks?.length) {
      checks.forEach((check) => {
        _data.read('checks', check, (err, originalCheckData) => {
          if (!err && originalCheckData) {
            // Pass it to the check validator, and let that function continue or log errors as needed
            workers.validateCheckData(originalCheckData)
          } else {
            console.log("Error reading one of the checks's data")
          }
        })
      })
    } else {
      console.log('Error: Could not find any checks to process')
    }
  })
}

// Sanity-check the check-data
workers.validateCheckData = (originalCheckData = {}) => {
  originalCheckData.id =
    typeof originalCheckData.id === 'string' &&
    originalCheckData.id.trim().length === 20
      ? originalCheckData.id
      : false

  originalCheckData.userPhone =
    typeof originalCheckData.userPhone === 'string' &&
    originalCheckData.userPhone.trim().length === 10
      ? originalCheckData.userPhone
      : false

  originalCheckData.protocol =
    typeof originalCheckData.protocol === 'string' &&
    ['http', 'https'].indexOf(originalCheckData.protocol) > -1
      ? originalCheckData.protocol
      : false

  originalCheckData.url =
    typeof originalCheckData.url === 'string' &&
    originalCheckData.url.trim().length > 0
      ? originalCheckData.url
      : false

  originalCheckData.method =
    typeof originalCheckData.method === 'string' &&
    ['post', 'get', 'put', 'delete'].indexOf(originalCheckData.method) > -1 &&
    originalCheckData.method.trim().length > 0
      ? originalCheckData.method
      : false

  originalCheckData.successCodes =
    originalCheckData.successCodes instanceof Array &&
    originalCheckData.successCodes.length > 0
      ? originalCheckData.successCodes
      : false

  originalCheckData.timeoutSeconds =
    typeof originalCheckData.timeoutSeconds === 'number' &&
    originalCheckData.timeoutSeconds % 1 === 0 &&
    originalCheckData.timeoutSeconds >= 1 &&
    originalCheckData.timeoutSeconds <= 5
      ? originalCheckData.timeoutSeconds
      : false

  // Set the keys that may not be set (if the workers have never seen this check before)
  originalCheckData.state =
    typeof originalCheckData.state === 'string' &&
    ['up', 'down'].indexOf(originalCheckData.state) > -1
      ? originalCheckData.state
      : 'down'

  originalCheckData.lastChecked =
    typeof originalCheckData.lastChecked === 'number' &&
    originalCheckData.lastChecked > 0
      ? originalCheckData.lastChecked
      : false

  // If all the checks pass, pass the data along to the next step in the process
  if (
    originalCheckData.id &&
    originalCheckData.userPhone &&
    originalCheckData.protocol &&
    originalCheckData.url &&
    originalCheckData.method &&
    originalCheckData.successCodes &&
    originalCheckData.timeoutSeconds
  ) {
    workers.performCheck(originalCheckData)
  } else {
    console.log(
      'Error: One of the checks is not properly formatted. Skipping it.'
    )
  }
}

// Perform the check, send the originalCheckData and the outcome of the check process, to the next step in the process
workers.performCheck = (originalCheckData) => {
  // Prepare the initial check outcome
  const checkOutcome = {
    error: false,
    responseCode: false,
  }

  // Mark that the outcome has not been sent yet
  const outcomeSent = false

  // Parse the hostname and the path out of the original check
  const parsedUrl = url.parse(
    originalCheckData.protocol + '://' + originalCheckData.url,
    true
  )
  const hostname = parsedUrl.hostname
  const path = parsedUrl.path // Using path and not "pathname" because we want the query string

  //  Construct the request
  const requestDetails = {
    protocol: originalCheckData.protocol + ':',
    hostname,
    method: originalCheckData.method.toUpperCase(),
    path,
    timeout: originalCheckData.timeoutSeconds * 1000,
  }

  // Instantiate the request object (using either the http or https module)
  const _moduleToUse =
    originalCheckData.module.protocol === 'http' ? http : https
  const req = _moduleToUse.request(requestDetails, (res) => {
    // Grab the status of the sent request
    const status = res.statusCode

    // Update the check outcome and pass the data along
    check.responseCode = status
    if (!outcomeSent) {
      workers.processCheckOutcome(originalCheckData, checkOutcome)
      outcomeSent = true
    }
  })

  //  Bind to the error event so it doesn't get thrown
  req.on('error', (e) => {
    // Update the checkOutcome and pass the data along
    checkOutcome.error = {
      error: true,
      value: e,
    }
    if (!outcomeSent) {
      workers.processCheckOutcome(originalCheckData, checkOutcome)
      outcomeSent = true
    }
  })

  // Bind to the timeout event
  req.on('timeout', (e) => {
    // Update the checkOutcome and pass the data along
    checkOutcome.error = {
      error: true,
      value: 'timeout',
    }
    if (!outcomeSent) {
      workers.processCheckOutcome(originalCheckData, checkOutcome)
      outcomeSent = true
    }
  })

  // End the request
  req.end()
}

// Process the check outcome, update the check data as needed and trigger an alert if needed
// Special logic for accomodating a check that has never been tested before (dont't alert on that one)
workers.processCheckOutcome = (originalCheckData, checkOutcome) => {
  //  Decide if the check is considered up or down
  const state =
    !checkOutcome.error &&
    checkOutcome.responseCode &&
    originalCheckData.successCodes.indexOf(checkOutcome.responseCode) > -1
      ? 'up'
      : 'down'

  // Decide if an alert is warranted
  const alertWarranted =
    originalCheckData.lastChecked && originalCheckData.state !== state

  // Update the check data
  const newCheckData = originalCheckData
  newCheckData.state = state
  newCheckData.lastChecked = Date.now()

  //  Save the updates
  _data.update('checks', newCheckData.id, (err) => {
    if (!err) {
      // Send the new check data to the next phase in the process if needed
      if (alertWarranted) {
        workers.alertUserToStatusChange(newCheckData)
      } else {
        console.log('Check outcome has not changed, no alert needed')
      }
    } else {
      console.log('Error trying to save updates to one of the checks')
    }
  })
}

// Alert the user as to a change in their check status
workers.alertUserToStatusChange = (newCheckData) => {
  const msg =
    'Alert: Your check for ' +
    newCheckData.method.toUpperCase() +
    ' ' +
    newCheckData.protocol +
    '://' +
    newCheckData.url +
    ' is currently ' +
    newCheckData.state
  helpers.sendTwilioSms(newCheckData.userPhone, msg, (err) => {
    if (!err) {
      console.log(
        'Success: User was alerted to a status change in their check, via sms: ',
        msg
      )
    } else {
      console.log(
        'Error: Could not send sms alert to user who had a state change in their check'
      )
    }
  })
}

// Timer to execute the worker-process once per minute
workers.loop = () => {
  setInterval(() => {
    workers.gatherAllChecks()
  }, 1000 * 60)
}

// Init scripts
workers.init = () => {
  // Execute all the checks immediately
  workers.gatherAllChecks()

  // Call the loop so the checks will execute later on
  workers.loop()
}

export default workers
