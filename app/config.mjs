/*
* Create and export configuration variables
*
*/

// Container for all the environments
const environments = {
  // Staging (default) environment
  staging: {
    port: 3000,
    envName: 'staging'
  },
  // Production environment
  production: {
    port: 5000,
    envName: 'production'
  }
}

// Determine which environment was passed as a command-line argument
const currentEnvironment = typeof process.env.NODE_ENV === 'string' ? process.env.NODE_ENV.toLowerCase() : ''

// Check that the current environment is one of the environments above, if not, default to staging
const environmentToExport = environments[currentEnvironment] ?? environments.staging

// Export the module
export default environmentToExport