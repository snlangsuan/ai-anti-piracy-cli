#!/usr/bin/env node

import fs from 'node:fs'
import { program } from 'commander'
import pckg from './../package.json' with { type: 'json' }
import {login, logout} from '../src/libs/auth.mjs'
import { caputre, tracking } from '../src/libs/action.mjs'

if (!fs.existsSync('./logs')) {
  fs.mkdirSync('./logs')
}

program
  .version(pckg.version)

program
  .command('login <token>')
  .description('Login and save the App Token')
  .option('--base-api <url>', 'Set base API URL', 'https://apai-api.jts.co.th/api/v1')
  .action(login)

program
  .command('logout')
  .description('Logout and delete the saved token')
  .action(logout)

program
  .command('capture <url>')
  .description('')
  .option('--timeout <ms>', 'Set timeout in millisecond', 6000)
  .option('--chrome-socket <endpoint>', 'Set chrome web socket debugger URL')
  .option('--no-headless', 'Run in headless mode')
  .action(caputre)

program
  .command('tracking')
  .description('')
  .option('--timeout <ms>', 'Set timeout in millisecond', 6000)
  .option('--intervals <ms>', 'Set intervals time in millisecond')
  .option('--chrome-socket <endpoint>', 'Set chrome web socket debugger URL')
  .option('--base-api <url>', 'Set base API URL', 'https://apai-api.jts.co.th/api/v1')
  .option('--no-headless', 'Run in headless mode')
  .action(tracking)
program.parse(process.argv)