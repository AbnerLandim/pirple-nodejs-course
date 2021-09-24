/*
  Request handlers
*/

// Dependencies
import _data from './data.mjs'
import helpers from './helpers.mjs'
import config from './config.mjs'

// Define the handlers
let handlers = {}

// Users
handlers.users = (data, callback) => {
  const acceptableMethods = ['post', 'get', 'put', 'delete']
  if (acceptableMethods.indexOf(data.method) > -1) {
    handlers._users[data.method](data, callback)
  } else {
    callback(405)
  }
}

// Container for the users submethods
handlers._users = {}

// Users - post
// Required data: firstName, lastName, phone, password, tosAgreement
// Optional data: none
handlers._users.post = (data, callback) => {
  // Check that all required fields are filled out
  const firstName =
    typeof data.payload.firstName === 'string' &&
    data.payload.firstName.trim().length
      ? data.payload.firstName.trim()
      : false
  const lastName =
    typeof data.payload.lastName === 'string' &&
    data.payload.lastName.trim().length
      ? data.payload.lastName.trim()
      : false
  const phone =
    typeof data.payload.phone === 'string' &&
    data.payload.phone.trim().length === 10
      ? data.payload.phone.trim()
      : false
  const password =
    typeof data.payload.password === 'string' &&
    data.payload.password.trim().length
      ? data.payload.password.trim()
      : false
  const tosAgreement =
    typeof data.payload.tosAgreement === 'boolean'
      ? data.payload.tosAgreement
      : false

  if (firstName && lastName && phone && password && tosAgreement) {
    // Make sure the user doesnt already exist
    _data.read('users', phone, (err, data) => {
      if (err) {
        // Hash the password
        const hashedPassword = helpers.hash(password)

        if (hashedPassword) {
          // Create the user object
          const userObject = {
            firstName,
            lastName,
            phone,
            hashedPassword,
            tosAgreement,
          }

          // Store the user
          _data.create('users', phone, userObject, (err) => {
            if (!err) {
              callback(200)
            } else {
              console.log(err)
              callback(500, { Error: 'Could not create the new user.' })
            }
          })
        } else {
          callback(500, { Error: "Could not the user's password." })
        }
      } else {
        callback(400, { Error: 'A user with that phone already exists.' })
      }
    })
  } else {
    callback(400, { Error: 'Missing required fields.' })
  }
}

// Users - get
// Required data: phone
// Optional data: none
handlers._users.get = (data, callback) => {
  // Check that the phone number is valid
  const phoneObject = helpers.parseJsonToObject(data.queryStringObject).phone
  const phone =
    typeof phoneObject === 'string' && phoneObject.trim().length === 10
      ? phoneObject.trim()
      : false
  if (phone) {
    // Get the token from the headers
    const token =
      typeof data.headers.token === 'string' ? data.headers.token : false

    // Verify that the given token is valid for the phone number
    handlers._handlers.verifyToken(token, phone, (tokenIsValid) => {
      if (tokenIsValid) {
        // Look up the user
        _data.read('users', phone, (err, data) => {
          if (!err && data) {
            // Remove the hashed password from the user object before returning it to the requester
            delete data.hashedPassword
            callback(200, data)
          } else {
            callback(404)
          }
        })
      } else {
        callback(403, {
          Error: 'Missing required token in header, or token is invalid',
        })
      }
    })
  } else {
    callback(400, { Error: 'Missing required field.' })
  }
}

// Users - put
// Required data: phone
// Optional data: firstName, lastName, password (at least one must be specified)
handlers._users.put = (data, callback) => {
  // Check for the required field
  const phone =
    typeof data.payload.phone === 'string' &&
    data.payload.phone.trim().length === 10
      ? data.payload.phone.trim()
      : false

  // Check for the optional fields
  const firstName =
    typeof data.payload.firstName === 'string' &&
    data.payload.firstName.trim().length
      ? data.payload.firstName.trim()
      : false
  const lastName =
    typeof data.payload.lastName === 'string' &&
    data.payload.lastName.trim().length
      ? data.payload.lastName.trim()
      : false
  const password =
    typeof data.payload.password === 'string' &&
    data.payload.password.trim().length
      ? data.payload.password.trim()
      : false

  // Error if the phone is invalid
  if (phone) {
    // Error if nothing is sent to update
    if (firstName || lastName || password) {
      // Get the token from the headers
      const token =
        typeof data.headers.token === 'string' ? data.headers.token : false
      handlers._handlers.verifyToken(token, phone, (tokenIsValid) => {
        if (tokenIsValid) {
          // Look up the user
          _data.read('users', phone, (err, userData) => {
            if (!err && userData) {
              // Update the necessary fields
              if (firstName) {
                userData.firstName = firstName
              }
              if (lastName) {
                userData.lastName = lastName
              }
              if (password) {
                userData.hashedPassword = helpers.hash(password)
              }
              // Store the new updates
              _data.update('users', phone, userData, (err) => {
                if (!err) {
                  callback(200)
                } else {
                  console.log(err)
                  callback(500, { Error: 'Could not update the user.' })
                }
              })
            } else {
              callback(400, { Error: 'The specified user does not exist.' })
            }
          })
        } else {
          callback(403, {
            Error: 'Missing required token in header, or token is invalid',
          })
        }
      })
    } else {
      callback(400, { Error: 'Missing fields to update.' })
    }
  } else {
    callback(400, { Error: 'Missing required field.' })
  }
}

// Users - delete
// Required data: phone
// Optional data: none
// @TODO Only let an authenticated user delete their own object, Don't let them delete anyone else's
handlers._users.delete = (data, callback) => {
  // Check that the phone number is valid
  const phoneObject = helpers.parseJsonToObject(data.queryStringObject).phone
  const phone =
    typeof phoneObject === 'string' && phoneObject.trim().length === 10
      ? phoneObject.trim()
      : false
  if (phone) {
    // Get the token from the headers
    const token =
      typeof JSON.parse(data.headers).token === 'string'
        ? JSON.parse(data.headers).token
        : false
    handlers._tokens.verifyToken(token, phone, (tokenIsValid) => {
      if (tokenIsValid) {
        // Look up the user
        _data.read('users', phone, (err, userData) => {
          if (!err && userData) {
            _data.delete('users', phone, (err) => {
              if (!err) {
                // Delete each of the checks associated with the user
                const userChecks =
                  typeof userData.checks === 'object' &&
                  userData.checks instanceof Array
                    ? userData.checks
                    : []
                const checksToDelete = userChecks.length

                if (checksToDelete > 0) {
                  let checksDeleted = 0
                  let deletetionErrors = false
                  // Loop through the checks
                  userChecks.forEach((checkId) => {
                    _data.delete('checks', checkId, (err) => {
                      if (err) {
                        deletetionErrors = true
                      }
                      checksDeleted++
                      if (checksDeleted === checksToDelete) {
                        if (!deletetionErrors) {
                          callback(200)
                        } else {
                          callback(500, {
                            Error:
                              "Erros encountered while attempting to delete all of the user's checks. All checks may not have been deleted from the system succesfully",
                          })
                        }
                      }
                    })
                  })
                } else {
                  callback(200)
                }
              } else {
                callback(500, { Error: 'Could not delete the specified user.' })
              }
            })
          } else {
            callback(400, { Error: 'Could not find the specified user.' })
          }
        })
      } else {
        callback(403, {
          Error: 'Missing required token in header, or token is invalid',
        })
      }
    })
  } else {
    callback(400, { Error: 'Missing required field.' })
  }
}

// Tokens
handlers.tokens = (data, callback) => {
  const acceptableMethods = ['post', 'get', 'put', 'delete']
  if (acceptableMethods.indexOf(data.method) > -1) {
    handlers._tokens[data.method](data, callback)
  } else {
    callback(405)
  }
}

// Container for all the tokens methods
handlers._tokens = {}

// Tokens - post
// Required data: phone, password
// Optional data: none
handlers._tokens.post = function (data, callback) {
  const phone =
    typeof data.payload.phone === 'string' &&
    data.payload.phone.trim().length === 10
      ? data.payload.phone.trim()
      : false
  const password =
    typeof data.payload.password === 'string' &&
    data.payload.password.trim().length
      ? data.payload.password.trim()
      : false

  if (phone && password) {
    // Lookup the user who matches that phone number
    _data.read('users', phone, (err, userData) => {
      if (!err && userData) {
        // Hash the sent password, and compare it to the password stored in the user object
        const hashedPassword = helpers.hash(password)
        if (hashedPassword === userData.hashedPassword) {
          // If valid, create a new token with a random name. Set expiration date 1 hour in the future.
          const tokenId = helpers.createRandomString(20)
          const expires = Date.now() + 1000 * 60 * 60
          const tokenObject = {
            phone,
            id: tokenId,
            expires,
          }

          // Store the token
          _data.create('tokens', tokenId, tokenObject, (err) => {
            if (!err) {
              callback(200, tokenObject)
            } else {
              callback(500, { Error: 'Could not create the new token' })
            }
          })
        } else {
          callback(400, {
            Error:
              "Password did not match the specified user's stored password",
          })
        }
      } else {
        callback(400, { Error: 'Could not find the specified user' })
      }
    })
  } else {
    callback(400, { Error: 'Missing required field(s)' })
  }
}

// Tokens - get
// Required data : id
// Optional data: none
handlers._tokens.get = function (data, callback) {
  // Check that the id is valid
  const parsedId = helpers.parseJsonToObject(data.queryStringObject).id
  const id =
    typeof parsedId === 'string' && parsedId.trim().length === 20
      ? parsedId.trim()
      : false
  if (id) {
    // Look up the token
    _data.read('tokens', id, (err, tokenData) => {
      if (!err && tokenData) {
        callback(200, tokenData)
      } else {
        callback(404)
      }
    })
  } else {
    callback(400, { Error: 'Missing required field.' })
  }
}

// Tokens - put
// Required data : id, extend
// Optional data : none
handlers._tokens.put = function (data, callback) {
  const id =
    typeof data.payload.id === 'string' && data.payload.id.trim().length === 20
      ? data.payload.id.trim()
      : false
  const extend =
    typeof data.payload.extend === 'boolean' && !!data.payload.extend
  if (id && extend) {
    // Lookup the token
    _data.read('tokens', id, (err, tokenData) => {
      if (!err && tokenData) {
        // Check to make sure the token is already expired
        if (tokenData.expires > Date.now()) {
          // Set the expiration an hour from now
          tokenData.expires = Date.now() + 1000 * 60 * 60

          // Store the new updates
          _data.update('tokens', id, tokenData, (err) => {
            if (!err) {
              callback(200)
            } else {
              callback(500, {
                Error: "Could not update the token's expiration",
              })
            }
          })
        } else {
          callback(400, {
            Error: 'The token has already expired, and cannot be extended',
          })
        }
      } else {
        callback(400, { Error: 'Specified token does not exist' })
      }
    })
  } else {
    callback(400, {
      Error: 'Missing required field(s) or field(s) are invalid',
    })
  }
}

// Tokens - delete
// Required data : id
// Optional data : none
handlers._tokens.delete = function (data, callback) {
  // Check that id number is valid
  const parsedId = helpers.parseJsonToObject(data.queryStringObject).id
  const id =
    typeof parsedId === 'string' && parsedId.trim().length === 20
      ? parsedId.trim()
      : false
  if (id) {
    // Look up the user
    _data.read('tokens', id, (err, tokenData) => {
      if (!err && tokenData) {
        _data.delete('tokens', id, (err) => {
          if (!err) {
            callback(200)
          } else {
            callback(500, { Error: 'Could not delete the specified token.' })
          }
        })
      } else {
        callback(400, { Error: 'Could not find the specified token.' })
      }
    })
  } else {
    callback(400, { Error: 'Missing required field.' })
  }
}

// Verify if a given token id is currently valid for a given user
handlers._tokens.verifyToken = (id, phone, callback) => {
  // Lookup the token
  _data.read('tokens', id, (err, tokenData) => {
    if (!err && tokenData) {
      // Check that the token is for the given user and has not expired
      if (tokenData.phone === phone && tokenData.expires > Date.now())
        callback(true)
      else callback(false)
    } else {
      callback(false)
    }
  })
}

// Checks
handlers.checks = (data, callback) => {
  const acceptableMethods = ['post', 'get', 'put', 'delete']
  if (acceptableMethods.indexOf(data.method) > -1) {
    handlers._checks[data.method](data, callback)
  } else {
    callback(405)
  }
}

// Container for all the checks methods
handlers._checks = {}

// Checks - post
// Required data: protocol, url, method, successCodes, timeoutSeconds
// Optional data: none

handlers._checks.post = (data, callback) => {
  // Validate inputs
  const protocol =
    typeof data.payload.protocol === 'string' &&
    ['https', 'http'].indexOf(data.payload.protocol) > -1
      ? data.payload.protocol
      : false
  const url =
    typeof data.payload.url === 'string' && data.payload.url.trim().length
      ? data.payload.url.trim()
      : false
  const method =
    typeof data.payload.method === 'string' &&
    ['post', 'get', 'put', 'delete'].indexOf(data.payload.method) > -1
      ? data.payload.method
      : false
  const successCodes =
    typeof data.payload.successCodes === 'object' &&
    data.payload.successCodes instanceof Array &&
    data.payload.successCodes.length
      ? data.payload.successCodes
      : false
  const timeoutSeconds =
    typeof data.payload.timeoutSeconds === 'number' &&
    data.payload.timeoutSeconds % 1 === 0 &&
    data.payload.timeoutSeconds >= 1 &&
    data.payload.timeoutSeconds <= 5
      ? data.payload.timeoutSeconds
      : false

  if (protocol && url && method && successCodes && timeoutSeconds) {
    // Get the tokens from the headers
    const token =
      typeof JSON.parse(data.headers).token === 'string'
        ? JSON.parse(data.headers).token
        : false

    // Lookup the user by reading the token
    _data.read('tokens', token, (err, tokenData) => {
      if (!err && tokenData) {
        const userPhone = tokenData.phone

        // Lookup the user data
        _data.read('users', userPhone, (err, userData) => {
          if (!err && userData) {
            const userChecks =
              typeof userData.checks === 'object' &&
              userData.checks instanceof Array
                ? userData.checks
                : []

            // Verify that the user has less than the number of max-checks-per-user
            if (userChecks.length < config.maxChecks) {
              // Create a random id for the check
              const checkId = helpers.createRandomString(20)

              // Create the object, and include the user's phone
              const checkObject = {
                id: checkId,
                userPhone,
                url,
                method,
                successCodes,
                timeoutSeconds,
              }

              // Save the object
              _data.create('checks', checkId, checkObject, (err) => {
                if (!err) {
                  // Add the check id to the user's object
                  userData.checks = userChecks
                  userData.checks.push(checkId)

                  // Save the new user data
                  _data.update('users', userPhone, userData, (err) => {
                    if (!err) {
                      // Return the data about the new check
                      callback(200, checkObject)
                    } else {
                      callback(500, {
                        Error: 'Could not update the user with the new check',
                      })
                    }
                  })
                } else {
                  callback(500, { Error: 'Could not create the new check' })
                }
              })
            } else {
              callback(400, {
                Error: `The user already has the maximum number of checks (${config.maxChecks})`,
              })
            }
          } else {
            callback(403)
          }
        })
      } else {
        callback(403)
      }
    })
  } else {
    callback(400, { Error: 'Missing required inputs, or inputs are invalid' })
  }
}

// Checks - get
// Required data: id
// Optional data: none
handlers._checks.get = (data, callback) => {
  // Check that the id is valid
  const id =
    typeof helpers.parseJsonToObject(data.queryStringObject).id === 'string' &&
    helpers.parseJsonToObject(data.queryStringObject).id.trim().length === 20
      ? helpers.parseJsonToObject(data.queryStringObject).id
      : false

  if (id) {
    // Lookup the check
    _data.read('checks', id, (err, checkData) => {
      if (!err && checkData) {
        // Get the token from the headers
        const token =
          typeof JSON.parse(data.headers).token === 'string'
            ? JSON.parse(data.headers).token
            : false

        // Verify that the given token is valid and belongs to the user who created the check
        handlers._tokens.verifyToken(
          token,
          checkData.userPhone,
          (tokenIsValid) => {
            if (tokenIsValid) {
              //  Return the check data
              callback(200, checkData)
            } else {
              callback(403)
            }
          }
        )
      } else {
        callback(404)
      }
    })
  } else {
    callback(400, { Error: 'Missing required field.' })
  }
}

// Checks - put
// Required data: id
// Optional data: protocol, url, method, successCodes, timeoutSeconds (one must be sent)
handlers._checks.put = (data, callback) => {
  // Check for the required field
  const id =
    typeof data.payload.id === 'string' && data.payload.id.trim().length === 20
      ? data.payload.id.trim()
      : false

  // Check for the optional fields
  const protocol =
    typeof data.payload.protocol === 'string' &&
    ['https', 'http'].indexOf(data.payload.protocol) > -1
      ? data.payload.protocol
      : false
  const url =
    typeof data.payload.url === 'string' && data.payload.url.trim().length
      ? data.payload.url.trim()
      : false
  const method =
    typeof data.payload.method === 'string' &&
    ['post', 'get', 'put', 'delete'].indexOf(data.payload.method) > -1
      ? data.payload.method
      : false
  const successCodes =
    typeof data.payload.successCodes === 'object' &&
    data.payload.successCodes instanceof Array &&
    data.payload.successCodes.length
      ? data.payload.successCodes
      : false
  const timeoutSeconds =
    typeof data.payload.timeoutSeconds === 'number' &&
    data.payload.timeoutSeconds % 1 === 0 &&
    data.payload.timeoutSeconds >= 1 &&
    data.payload.timeoutSeconds <= 5
      ? data.payload.timeoutSeconds
      : false

  // Check to make sure id is valid
  if (id) {
    // Check to make sure one or more optional fields has been sent
    if (protocol || url || method || successCodes || timeoutSeconds) {
      const token =
        typeof JSON.parse(data.headers).token === 'string'
          ? JSON.parse(data.headers).token
          : false
      // Lookup the check
      _data.read('checks', id, (err, checkData) => {
        if (!err && checkData) {
          // Verify that the given token is valid and belongs to the user who created the check
          handlers._tokens.verifyToken(
            token,
            checkData.userPhone,
            (tokenIsValid) => {
              if (tokenIsValid) {
                //  Update the check data
                if (protocol) checkData.protocol = protocol
                if (url) checkData.url = url
                if (method) checkData.method = method
                if (successCodes) checkData.successCodes = successCodes
                if (timeoutSeconds) checkData.timeoutSeconds = timeoutSeconds

                // Store the updates
                _data.update('checks', id, checkData, (err) => {
                  if (!err) {
                    callback(200)
                  } else callback(500, { Error: 'Could not update the check' })
                })
              } else {
                callback(403)
              }
            }
          )
        } else {
          callback(400, { Error: 'Check id did not exist' })
        }
      })
    } else {
      callback(400, { Error: 'Missing fields to update' })
    }
  } else {
    callback(400, { Error: 'Missing required field' })
  }
}

// Checks - delete
// Required data: id
// Optional data: none
handlers._checks.delete = (data, callback) => {
  // Check that id number is valid
  const parsedId = helpers.parseJsonToObject(data.queryStringObject).id
  const id =
    typeof parsedId === 'string' && parsedId.trim().length === 20
      ? parsedId.trim()
      : false
  if (id) {
    // Lookup the user
    _data.read('checks', id, (err, checkData) => {
      if (!err && checkData) {
        const token =
          typeof JSON.parse(data.headers).token === 'string'
            ? JSON.parse(data.headers).token
            : false
        handlers._tokens.verifyToken(
          token,
          checkData.userPhone,
          (tokenIsValid) => {
            if (tokenIsValid) {
              // Delete the check data
              _data.delete('checks', id, (err) => {
                if (!err) {
                  // Look up the user
                  _data.read('users', checkData.userPhone, (err, userData) => {
                    if (!err && userData) {
                      const userChecks =
                        typeof userData.checks === 'object' &&
                        userData.checks instanceof Array
                          ? userData.checks
                          : []

                      // Remove the delete check from their list of checks
                      const checkPosition = userChecks.indexOf(id)

                      if (checkPosition > -1) {
                        userChecks.splice(checkPosition, 1)
                        // Re-save the user's data
                        _data.update(
                          'users',
                          checkData.userPhone,
                          userData,
                          (err) => {
                            if (!err) {
                              callback(200)
                            } else {
                              callback(500, {
                                Error: 'Could not update the user',
                              })
                            }
                          }
                        )
                      } else {
                        callback(500, {
                          Error:
                            'Could not find the check on the users object, so could not remove it',
                        })
                      }
                    } else {
                      callback(500, {
                        Error:
                          'Could not find the specified user who created the check, so could not remove the check from the list of checks on the user object',
                      })
                    }
                  })
                } else {
                  callback(500, { Error: 'Could not delete the check data' })
                }
              })
            } else {
              callback(403)
            }
          }
        )
      } else {
        callback(400, { Error: 'The specified check id does not exist' })
      }
    })
  } else {
    callback(400, { Error: 'Missing required field.' })
  }
}

// Ping handler
handlers.ping = (data, callback) => {
  callback(200)
}

// Hello world handler
handlers.hello = (data, callback) => {
  callback(200, { message: 'Hello, world' })
}

// Not found handler
handlers.notFound = (data, callback) => {
  callback(404)
}

export default handlers
