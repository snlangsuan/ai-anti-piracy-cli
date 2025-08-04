import chalk from 'chalk'
import { useHttpInstance } from './http.instance.mjs'
import { setAppToken } from './api.mjs'

async function chkToken(token) {
  try {
    const instance = useHttpInstance(token)
    const res = await instance.get('/domains/policies', { params: { type: 'BLACKLIST', page: 1, limit: 1 } })
    return res.status === 200
  } catch (error) {
    console.log(chalk.red(`[error] ${error.message}`))
  }
}

export const login = async (token) => {
  if (!token) {
    console.log(chalk.red('[error] Please provide your token.'))
    return
  }
  const res = await chkToken(token)
  if (res) {
    setAppToken(token)
    console.log(chalk.green('[info] Login successful! Your token has been stored securely.'))
  } else {
    console.log(chalk.red('[error] Invalid token.'))
  }
}

export const logout = async () => {
  try {
    await keytar.deletePassword(SERVICE_NAME, ACCOUNT_NAME)
    console.log(chalk.green('[info] Logout successful! Your token has been removed.'))
  } catch (error) {
    console.log(chalk.red(`[error] ${error.message}`))
  }
}
