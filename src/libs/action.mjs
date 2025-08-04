import puppeteer from 'puppeteer'
import UserAgent from 'user-agents'
import { getAppToken } from './api.mjs'
import chalk from 'chalk'
import { useHttpInstance } from './http.instance.mjs'
import dig from 'dns-dig'
import dns from 'node:dns/promises'

let timeout = null

async function getCapture(url, options) {
  let browser = null
  try {
    const userAgent = new UserAgent({ deviceCategory: 'desktop' })
    const randomUserAgent = userAgent.toString()
    browser = await puppeteer.launch({
        headless: true,
        args: ['--remote-debugging-port=9222', '--remote-debugging-address=0.0.0.0', '--no-sandbox'],
    })
    const page = await browser.newPage()
    page.setViewport({ width: 1920, height: 1080 })
    await page.setUserAgent(randomUserAgent)
    const filename = `img_${Date.now()}.png`
    await page.goto(url, { timeout: options.timeout })
    await page.screenshot({ path: `./logs/${filename}` })
    return filename
  } catch (error) {
    console.log(error)
  } finally {
    await browser.close()
  }
}

async function getDomain(token) {
  let total = 0
  let page = 1
  const urls = []
  const instance = useHttpInstance(token)
  while (true) {
    const res = await instance.get('/domains/policies', { params: { type: 'BLACKLIST', page, limit: 100 } })
    total = res.data.metadata.total
    urls.push(...res.data.items)
    page += 1
    if (urls.length >= total) break
  }
  return urls
}

async function checkDns(domain) {
  try {
    const host = dns.getServers()[0]
    // const records = await dig.resolveIp4(domain, { host })
    // console.log(domain, records)
    console.log(domain, '2', await dns.resolveAny(domain))
  } catch (error) {
    console.log(domain, error.code, error.message)
    // console.error(`❌ Could not resolve DNS for ${domain}:`, error.code || error.message);
  }
}

async function startTracking(options) {
  if (timeout) clearTimeout(timeout)
  const token = await getAppToken()
  if (!token) {
    console.log(chalk.red('[error] App token not found'))
    return
  }

  try {
    const domains = await getDomain(token)
    for (const ds of domains) {
      checkDns(ds.hostname)
    }
  } catch (error) {
    // console.log(error)
  }

  timeout = setTimeout(startTracking, options.intervals)
}

export const caputre = async (url, options) => {
  const file = await getCapture(url, options)
  console.log(file)
}

export const tracking = async (options) => {
  startTracking(options)
}
