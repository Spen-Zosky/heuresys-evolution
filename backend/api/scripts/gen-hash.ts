import bcrypt from 'bcryptjs'

const password = process.argv[2] || 'sysadmin123'
const hash = await bcrypt.hash(password, 12)
console.log(hash)
