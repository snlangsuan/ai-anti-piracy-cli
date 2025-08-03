#!/usr/bin/env node

import { program } from 'commander'
import pckg from './../package.json' with { type: 'json' }
import {login, logout} from '../src/libs/auth.mjs'
import { caputre } from '../src/libs/action.mjs'

program
  .version(pckg.version)

program
  .command('login <token>')
  .description('Login and save the App Token')
  .action(login)

program
  .command('logout')
  .description('Logout and delete the saved token')
  .action(logout)

program
  .command('capture <url>')
  .description('')
  .action(caputre)

program.parse(process.argv)