import puppeteer from 'puppeteer'
import UserAgent from 'user-agents'
import { getAppToken } from './api.mjs'
import chalk from 'chalk'
import { useHttpInstance } from './http.instance.mjs'
import dig from 'dns-dig'
import dns from 'node:dns/promises'
import axios from 'axios'
import https from 'node:https'
import cliProgress from 'cli-progress'
import * as cheerio from 'cheerio'
import fs from 'node:fs'
import dayjs from 'dayjs'

dns.setDefaultResultOrder('ipv4first')

let timeout = null

async function getCapture(url, options) {
  let browser = null
  try {
    const userAgent = new UserAgent({ deviceCategory: 'desktop' })
    const randomUserAgent = userAgent.toString()
    const puppeteerOptions = {
      ignoreHTTPSErrors: true,
      headless: true,
      args: [
        '--ignore-certificate-errors',
        '--no-sandbox',
        '--disable-gpu',
        '--disable-sync',
        '--disable-translate',
        '--disable-extensions',
        '--disable-default-apps',
        '--disable-background-networking',
        '--safebrowsing-disable-auto-update',
        '--mute-audio',
        '--no-first-run',
        '--hide-scrollbars',
        '--metrics-recording-only',
        '--ignore-certificate-errors',
      ],
    }
    if (options.chromeSocket) {
      puppeteerOptions.browserWSEndpoint = options.chromeSocket
    }
    browser = await puppeteer.launch(puppeteerOptions)
    const page = await browser.newPage()
    page.setViewport({ width: 1920, height: 1080 })
    await page.setUserAgent(randomUserAgent)
    const filename = `img_${Date.now()}.png`
    await page.goto(url, { timeout: options.timeout })
    await page.screenshot({ path: `./logs/${filename}` })
    return [null, `./logs/${filename}`]
  } catch (error) {
    if (error instanceof puppeteer.TimeoutError) {
      return ['CAPTIMEOUT', null]
    }
    return ['CAPUNKNOWNERROR', null]
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
    const res = await instance.get('/domains/policies', {
      params: { type: 'BLACKLIST', page, limit: 100, sort: 'created_at', desc: true },
    })
    total = res.data.metadata.total
    urls.push(...res.data.items)
    page += 1
    if (urls.length >= total) break
  }
  return urls
}

async function getISP() {
  try {
    const ipRes = await axios.get('https://api.ipify.org?format=json', { responseType: 'json' })
    const data = (await ipRes.data) ?? {}
    const ipAddress = data.ip
    const response = await fetch(`https://ipleak.net/${ipAddress}`)
    const text = await response.text()
    const $ = cheerio.load(text)
    const ipbox = $('.ip_box')
    const ipaddr = ipbox?.find('.ip')?.text() ?? ''
    const isp = ipbox?.find('.isp')?.text() ?? ''
    return { ipaddr, isp }
  } catch {
    return { ipaddr: null, isp: null }
  }
}

async function checkAccess(url, timeout) {
  try {
    const userAgent = new UserAgent({ deviceCategory: 'desktop' })
    const randomUserAgent = userAgent.toString()
    const res = await axios.get(url, {
      timeout,
      headers: {
        'User-Agent': randomUserAgent,
      },
      httpsAgent: new https.Agent({ rejectUnauthorized: false }),
      transitional: {
        clarifyTimeoutError: true,
      },
    })
    return [res.status === 200, 0]
  } catch (error) {
    if (error.code === 'ENOTFOUND' && /^https/.test(url)) {
      return await checkAccess(url.replace('https://', 'http://'), timeout)
    } else if (error.code === 'ENOTFOUND' && /www\./.test(url)) {
      return await checkAccess(url.replace('www.', ''), timeout)
    }
    return [false, error.code]
  }
}

async function addLog(data, token) {
  const instance = useHttpInstance(token)
  try {
    const { screenshot, ...urls } = data
    const transaction = await instance.post('/domains/checks', { urls: [urls] })
    if (screenshot && transaction.data.id) {
      const tranId = transaction.data.id
      const file = fs.readFileSync(screenshot)
      try {
        await instance.post(`/domains/checks/${tranId}/screenshot`, file, {
          headers: {
            'Content-Type': 'image/png',
          },
        })
      } catch {
        // pass
      } finally {
        fs.unlinkSync(screenshot)
      }
    }
  } catch (error) {
    console.error(error)
  }
}

async function startTracking(options) {
  if (timeout) clearTimeout(timeout)
  const token = await getAppToken()
  if (!token) {
    console.log(chalk.red('[error] App token not found'))
    return
  }

  const { ipaddr, isp } = await getISP()
  if (!ipaddr || !isp) {
    console.log(chalk.red('[error] Failed to get ISP'))
    return
  }

  const bar1 = new cliProgress.SingleBar({}, cliProgress.Presets.shades_classic)
  try {
    const domains = await getDomain(token)
    // const data = []
    bar1.start(domains.length, 0)
    for (const ds of domains) {
      const [accessed, code] = await checkAccess(ds.url, options.timeout)
      const result = {
        url: ds.url,
        client_ip: ipaddr,
        hostname: ds.hostname,
        network: isp,
        is_resolvable: accessed,
      }
      if (code) result.error = code
      if (accessed) {
        const [capError, file] = await getCapture(ds.url, options)
        if (capError) {
          result.error = capError
          result.is_resolvable = false
        } else {
          result.screenshot = file
        }
      }
      await addLog(result, token)
      bar1.increment()
    }
  } catch (error) {
    console.log(error)
  } finally {
    bar1.stop()
    console.log('\n')
  }

  timeout = setTimeout(startTracking, options.intervals)
  console.log('next time:', dayjs().add(options.intervals, 'ms').format('YYYY-MM-DD HH:mm:ss'))
}

export const caputre = async (url, options) => {
  const file = await getCapture(url, options)
  console.log(file)
}

export const tracking = async (options) => {
  startTracking(options)
}
