/*
  Request handlers
*/

// Dependencies
import _data from './data.mjs';
import helpers from './helpers.mjs';

// Define the handlers
let handlers = {};

// Users
handlers.users = (data, callback) => {
  const acceptableMethods = ['post', 'get', 'put', 'delete'];
  if (acceptableMethods.indexOf(data.method) > -1) {
    handlers._users[data.method](data, callback);
  } else {
    callback(405);
  }
};

// Container for the users submethods
handlers._users = {};

// Users - post
// Required data: firstName, lastName, phone, password, tosAgreement
// Optional data: none
handlers._users.post = (data, callback) => {
  // Check that all required fields are filled out
  const firstName =
    typeof data.payload.firstName === 'string' &&
    data.payload.firstName.trim().length
      ? data.payload.firstName.trim()
      : false;
  const lastName =
    typeof data.payload.lastName === 'string' &&
    data.payload.lastName.trim().length
      ? data.payload.lastName.trim()
      : false;
  const phone =
    typeof data.payload.phone === 'string' &&
    data.payload.phone.trim().length === 10
      ? data.payload.phone.trim()
      : false;
  const password =
    typeof data.payload.password === 'string' &&
    data.payload.password.trim().length
      ? data.payload.password.trim()
      : false;
  const tosAgreement =
    typeof data.payload.tosAgreement === 'boolean'
      ? data.payload.tosAgreement
      : false;

  if (firstName && lastName && phone && password && tosAgreement) {
    // Make sure the user doesnt already exist
    _data.read('users', phone, (err, data) => {
      if (err) {
        // Hash the password
        const hashedPassword = helpers.hash(password);

        if (hashedPassword) {
          // Create the user object
          const userObject = {
            firstName,
            lastName,
            phone,
            hashedPassword,
            tosAgreement,
          };

          // Store the user
          _data.create('users', phone, userObject, (err) => {
            if (!err) {
              callback(200);
            } else {
              console.log(err);
              callback(500, { Error: 'Could not create the new user.' });
            }
          });
        } else {
          callback(500, { Error: "Could not the user's password." });
        }
      } else {
        callback(400, { Error: 'A user with that phone already exists.' });
      }
    });
  } else {
    callback(400, { Error: 'Missing required fields.' });
  }
};

// Users - get
// Required data: phone
// Optional data: none
// @TODO Only let an authenticated user access their object. Don't let them access anyone else's
handlers._users.get = (data, callback) => {
  // Check that the phone number is valid
  const phoneObject = helpers.parseJsonToObject(data.queryStringObject).phone;
  const phone =
    typeof phoneObject === 'string' && phoneObject.trim().length === 10
      ? phoneObject.trim()
      : false;
  if (phone) {
    // Look up the user
    _data.read('users', phone, (err, data) => {
      if (!err && data) {
        // Remove the hashed password from the user object before returning it to the requester
        delete data.hashedPassword;
        callback(200, data);
      } else {
        callback(404);
      }
    });
  } else {
    callback(400, { Error: 'Missing required field.' });
  }
};

// Users - put
// Required data: phone
// Optional data: firstName, lastName, password (at least one must be specified)
// @TODO Only let an authenticated user update their own object, Don't let them update anyone else's
handlers._users.put = (data, callback) => {
  // Check for the required field
  const phone =
    typeof data.payload.phone === 'string' &&
    data.payload.phone.trim().length === 10
      ? data.payload.phone.trim()
      : false;

  // Check for the optional fields
  const firstName =
    typeof data.payload.firstName === 'string' &&
    data.payload.firstName.trim().length
      ? data.payload.firstName.trim()
      : false;
  const lastName =
    typeof data.payload.lastName === 'string' &&
    data.payload.lastName.trim().length
      ? data.payload.lastName.trim()
      : false;
  const password =
    typeof data.payload.password === 'string' &&
    data.payload.password.trim().length
      ? data.payload.password.trim()
      : false;

  // Error if the phone is invalid
  if (phone) {
    // Error if nothing is sent to update
    if (firstName || lastName || password) {
      // Look up the user
      _data.read('users', phone, (err, userData) => {
        if (!err && userData) {
          // Update the necessary fields
          if (firstName) {
            userData.firstName = firstName;
          }
          if (lastName) {
            userData.lastName = lastName;
          }
          if (password) {
            userData.hashedPassword = helpers.hash(password);
          }
          // Store the new updates
          _data.update('users', phone, userData, (err) => {
            if (!err) {
              callback(200);
            } else {
              console.log(err);
              callback(500, { Error: 'Could not update the user.' });
            }
          });
        } else {
          callback(400, { Error: 'The specified user does not exist.' });
        }
      });
    } else {
      callback(400, { Error: 'Missing fields to update.' });
    }
  } else {
    callback(400, { Error: 'Missing required field.' });
  }
};

// Users - delete
// Required data: phone
// Optional data: none
// @TODO Only let an authenticated user delete their own object, Don't let them delete anyone else's
// @TODO Clean up (delete) any other data files associated with this user
handlers._users.delete = (data, callback) => {
  // Check that the phone number is valid
  const phoneObject = helpers.parseJsonToObject(data.queryStringObject).phone;
  const phone =
    typeof phoneObject === 'string' && phoneObject.trim().length === 10
      ? phoneObject.trim()
      : false;
  if (phone) {
    // Look up the user
    _data.read('users', phone, (err, data) => {
      if (!err && data) {
        _data.delete('users', phone, (err) => {
          if (!err) {
            callback(200);
          } else {
            callback(500, { Error: 'Could not delete the specified user.' });
          }
        });
      } else {
        callback(400, { Error: 'Could not find the specified user.' });
      }
    });
  } else {
    callback(400, { Error: 'Missing required field.' });
  }
};

// Ping handler
handlers.ping = (data, callback) => {
  callback(200);
};

// Hello world handler
handlers.hello = (data, callback) => {
  callback(200, { message: 'Hello, world' });
};

// Not found handler
handlers.notFound = (data, callback) => {
  callback(404);
};

export default handlers;
