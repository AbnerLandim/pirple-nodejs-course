/*
 * Create and export configuration variables
 *
 */

// Container for all the environments
const environments = {
  // Staging (default) environment
  staging: {
    httpPort: 3000,
    httpsPort: 3001,
    envName: 'staging',
    hashingSecret: 'thisIsASecret',
    maxChecks: 5,
    twilio: {
      accountSid: 'ACb32d411ad7fe886aac54c665d25e5c5d',
      authToken: '9455e3eb3109edc12e3d8c92768f7a67',
      fromPhone: '+15005550006',
    },
  },
  // Production environment
  production: {
    httpPort: 5000,
    httpsPort: 5001,
    envName: 'production',
    hashingSecret: 'thisIsAlsoASecret',
    maxChecks: 5,
    twilio: {
      accountSid: '',
      authToken: '',
      fromPhone: '',
    },
  },
}

// Determine which environment was passed as a command-line argument
const currentEnvironment =
  typeof process.env.NODE_ENV === 'string'
    ? process.env.NODE_ENV.toLowerCase()
    : ''

// Check that the current environment is one of the environments above, if not, default to staging
const environmentToExport =
  environments[currentEnvironment] ?? environments.staging

// Export the module
export default environmentToExport
