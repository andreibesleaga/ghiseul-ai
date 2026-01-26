const crypto = require('crypto');
const knownPassword = 'password123'; // Simple password for testing

const hashedPassword = crypto
  .createHash('sha256')
  .update(knownPassword)
  .digest('hex');

console.log('Use this hash for all users:', hashedPassword);