import fs from 'node:fs'
import dayjs from 'dayjs1'
import puppeteer from 'puppeteer'
import UserAgent from 'user-agents'

export async function crawl(startUrl, options) {
  const userAgent = new UserAgent({ deviceCategory: 'desktop' })
  const visited = new Set()
  const queue = [{ url: startUrl, depth: 0 }]
  const baseUrl = new URL(startUrl)

  const found = new Set()

  const keywords = options.keyword ?? []
  if (keywords.length > 0) {
    console.log('[info] filter by keyword:', keywords)
  }

  const puppeteerOptions = {
    ignoreHTTPSErrors: true,
    headless: options.headless ?? 'new',
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
  const browser = await puppeteer.launch(puppeteerOptions)

  const processQueue = async () => {
    while (queue.length > 0) {
      const batch = queue.splice(0, options.concurrency ?? 1)
      await Promise.all(batch.map((item) => processUrl(item)))
    }
  }

  const processUrl = async ({ url, depth }) => {
    if (visited.has(url) || depth > Number(options.maxDepth)) {
      return
    }

    visited.add(url)
    console.log(`[Depth: ${depth}] กำลังเยี่ยมชม: ${url}`)

    let page
    try {
      page = await browser.newPage()
      const randomUserAgent = userAgent.toString()
      await page.setUserAgent(randomUserAgent)
      await page.setViewport({ width: 1280, height: 720 })

      await page.setRequestInterception(true)
      page.on('request', (req) => {
        if (['image', 'stylesheet', 'font', 'media'].includes(req.resourceType())) {
          req.abort()
        } else {
          req.continue()
        }
      })

      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: Number(options.timeout) })

      const title = await page.title()
      console.log(`  -> Title: ${title}`)

      if (keywords.length > 0) {
        const pageText = await page.$eval('body', (body) => body.innerText)
        const textLower = pageText.toLowerCase()
        const keywordFound = keywords.some((kw) => textLower.includes(kw.toLowerCase()))

        if (!keywordFound) {
          console.log(`  -> ไม่พบ Keyword ในหน้านี้, ข้ามการค้นหาลิงก์...`)
          return
        } else {
          found.add(url)
          console.log(`  -> พบ Keyword ในเนื้อหาของหน้า, กำลังค้นหาลิงก์...`)
        }
      }

      const content = await page.content()
      const urlRegex = /https?:\/\/[^\s"'<>`]+/g
      const allFoundUrls = content.match(urlRegex) || []

      const resourceExtensions = /\.(css|js|jpg|jpeg|png|gif|svg|webp|ico|woff|woff2|ttf|eot)(\?.*)?$/i
      const filteredUrls = allFoundUrls.filter(u => !resourceExtensions.test(u))

      const uniqueUrls = [...new Set(filteredUrls)]
      for (const foundUrl of uniqueUrls) {
        try {
          const newUrl = new URL(foundUrl);
          if (newUrl.hostname === baseUrl.hostname && !visited.has(newUrl.href)) {
            queue.push({ url: newUrl.href, depth: depth + 1 });
          }
        } catch {
          // pass
        }
      }

      // const links = await page.$$eval('a', (anchors) => anchors.map((anchor) => anchor.href))
      // for (const link of links) {
      //   if (link) {
      //     try {
      //       const absoluteUrl = new URL(link, baseUrl.origin).href
      //       const newUrl = new URL(absoluteUrl)
      //       if (newUrl.hostname === baseUrl.hostname && !visited.has(absoluteUrl)) {
      //         queue.push({ url: absoluteUrl, depth: depth + 1 })
      //       }
      //     } catch (urlError) {
      //       // pass
      //     }
      //   }
      // }
    } catch (error) {
      console.error(`  -> ไม่สามารถเข้าถึงหรือประมวลผล ${url} ได้: ${error.message}`)
    } finally {
      if (page) {
        await page.close()
      }
    }
  }


  // while (queue.length > 0) {
  //   const { url, depth } = queue.shift()
  //   if (visited.has(url) || depth > Number(options.maxDepth)) continue
  //   visited.add(url)
  //   console.log(`[info][Depth: ${depth}] visting: ${url}`)

  //   let page
  //   try {
  //     page = await browser.newPage()
  //     await page.goto(url, { waitUntil: 'networkidle2', timeout: 60000 })
  //     const title = await page.title()
  //     console.log(`  -> Title: ${title}`)

  //     if (keywords.length > 0) {
  //       const pageText = await page.$eval('body', body => body.innerText)
  //       const textLower = pageText.toLowerCase()
  //       const keywordFound = keywords.some(kw => textLower.includes(kw.toLowerCase()))
  //       if (!keywordFound) continue
  //     }

  //     const links = await page.$$eval('a', anchors =>
  //       anchors.map(anchor => anchor.href)
  //     )
  //     for (const link of links) {
  //       if (!link) continue
  //       try {
  //         const absoluteUrl = new URL(link, baseUrl.origin).href;
  //         const newUrl = new URL(absoluteUrl);

  //         if (newUrl.hostname === baseUrl.hostname && !visited.has(absoluteUrl)) {
  //           queue.push({ url: absoluteUrl, depth: depth + 1 });
  //         }
  //       } catch {
  //         // pass
  //       }
  //     }
  //   } catch (error) {
  //     console.error(`  -> can not access or process ${url} ได้: ${error.message}`)
  //   } finally {
  //     if (page) {
  //       await page.close();
  //     }
  //   }
  // }
  const startTime = dayjs()
  await processQueue()
  await browser.close()

  console.log('------------------------------------')
  console.log(`process time: ${dayjs().diff(startTime, 'minutes')}`)
  console.log(`Visit all ${visited.size} pages.`)
  console.log([...found])
}
