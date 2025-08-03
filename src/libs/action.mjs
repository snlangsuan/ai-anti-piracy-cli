import puppeteer from 'puppeteer'

async function getCapture(url) {
  // return new Promise((resolve, reject) => {
  //   CDP(async (client) => {
  //     const { Page } = client
  //     try {
  //       await Page.enable()
  //       await Page.navigate({ url })
  //       await Page.loadEventFired()
  //       const { data } = await Page.captureScreenshot()
  //       const filename = `img_${Date.now()}.png`
  //       fs.writeFileSync(filename, Buffer.from(data, 'base64'))
  //       resolve(filename)
  //     } catch (err) {
  //       reject(err)
  //     } finally {
  //       await client.close()
  //     }
  //   })
  // })
  let browser = null
  try {
    browser = await puppeteer.launch({
        headless: false,
        args: ['--remote-debugging-port=9222', '--remote-debugging-address=0.0.0.0', '--no-sandbox'],
    })
    const page = await browser.newPage()
    page.setViewport({ width: 1920, height: 1080 })
    const filename = `img_${Date.now()}.png`
    await page.goto(url, { waitUntil: 'networkidle0' })
    await page.screenshot({ path: `./logs/${filename}` })
  } catch (error) {
    console.log(error)
  } finally {
    await browser.close()
  }
}

export const caputre = async (url) => {
  const file = await getCapture(url)
  console.log(file)
}
