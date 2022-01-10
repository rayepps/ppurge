#!/usr/bin/env node

import _ from 'radash'
import fs from 'fs-extra'
import parse from 'minimist'
import chalk from 'chalk'
import minimatch from 'minimatch'
import ora from 'ora'
import { resolve, dirname, join as joinPath } from 'path'


type Args = {
  root?: string
  r?: string
  purge?: boolean
  p?: boolean
  size?: boolean
  s?: boolean
  help?: boolean
  config?: string
  c?: string
  filter?: string
  f?: string
}

const ppurge = async (args: Args) => {

  const root = args.r ?? args.root ?? process.cwd()
  const configPath = args.c ?? args.config ?? joinPath(root, '.ppurge')
  const filter = args.f ?? args.filter ?? null
  const purge = args.p ?? args.purge ?? false
  const size = args.s ?? args.size ?? false
  const help = args.help ?? false
  const configPathGiven = !!args.c || !!args.config

  if (help) {
    printHelp()
    return
  }
  
  const [,rulesText] = await _.try(() => {
    return fs.readFile(configPath, 'utf8')
  })()
  if (!rulesText && configPathGiven) {
    console.warn(`Did not find a file at ${configPath}.`)
    if (!filter) {
      console.error('Quitting, ppurge requires a config file or a --filter,-f arg to work.')
      return
    }
  }
  if (!!rulesText && !!filter) {
    console.warn(`${chalk.yellow('WARN:')} Ignoring the configuration file found at ${configPath} because a --filter,-f arg was provided`)
  }

  const rules = parseIgnoreRules(
    filter
      ? filter.split(';').join('\n')
      : rulesText
  )
  
  // Stats
  const start = Date.now()
  const hud = ora('Searching files').start()

  const matchesObject: Record<string, Match> = {}
  const isMatch = (f: string) => matchesObject[f] ? true : false
  const absRoot = root.startsWith('~')
    ? root.replace(/^~/, process.env.HOME)
    : root

  for await (const f of crawlDirectory(absRoot, isMatch) as string[]) {
    const match = doesFilePassRules(f, rules)
    hud.text = `Searching ${dirname(f)}`
    if (!match) continue
    hud.stop()
    if (match.exclude) {
      console.log(`${chalk.green('keep:')} ${f}`)
    } else {
      console.log(`${chalk.red('purge:')} ${f}`)
    }
    hud.start()
    if (!size || match.exclude) {
      matchesObject[f] = match
    } else {
      matchesObject[f] = {
        ...match,
        size: await getTotalPathSize(f)
      }
    }
  }

  const end = +new Date()
  hud.stop()

  const includes = Object.values(matchesObject).filter(m => m.include)
  const totalSize = bytesToSize(_.sum(includes, i => i.size))

  if (size) {
    console.log(`found ${includes.length} purgable locations (${chalk.red(totalSize)}) in ${end - start}ms`)
  } else {
    console.log(`found ${includes.length} purgable locations in ${end - start}ms`)
  }

  if (!purge) {
    return
  }

  console.log(chalk.red.bold('PURGING'))
  hud.start('Deleting files')

  for (const inc of includes) {
    const lstat = await fs.lstat(inc.filename)
    if (lstat.isSymbolicLink()) {
      hud.stop()
      console.log('Skipping symlink: ', inc.filename)
      hud.start()
      continue
    }
    hud.text = `Deleting ${inc.filename}`
    await fs.remove(inc.filename)
    hud.stop()
    console.log(`${chalk.red('purged:')} ${inc.filename}`)
    hud.start()
  }

  hud.stop()

}

async function* crawlDirectory(dir: string, isMatch?: (f: string) => boolean) {
  const dirents = await fs.readdir(dir, { withFileTypes: true })
  for (const dirent of dirents) {
    const res = resolve(dir, dirent.name)
    yield res
    // If the file was a match then skip going through
    // the child paths. It will be either deleted or
    // ignored as a match.
    const wasMatch = isMatch && isMatch(res)
    if (wasMatch) continue
    if (dirent.isDirectory()) {
      yield* crawlDirectory(res, isMatch)
    }
  }
}

const getTotalPathSize = async (path: string) => {
  let size = 0
  const [, stat] = await _.try(fs.stat)(path)
  if (stat.isDirectory()) {
    for await (const f of crawlDirectory(path)) {
      const [err, stats] = await _.try(fs.stat)(f)
      if (err) continue // not very acurate... *shrug*
      size += stats.size
    }
  } else {
    size = stat.size
  }
  return size
}

const bytesToSize = (bytes: number) => {
  var sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB']
  if (bytes == 0) return '0 Byte'
  var i = Math.floor(Math.log(bytes) / Math.log(1024))
  return Math.round(bytes / Math.pow(1024, i)) + ' ' + sizes[i]
}

type Match = Rule & {
  filename: string
  size?: number
}

const doesFilePassRules = (filename: string, rules: Rule[]): Match | null => {
  const rule = rules.find(r => minimatch(filename, r.pattern))
  if (!rule) return null
  return {
    ...rule,
    filename
  }
}

const parseIgnoreRules = (ignoreFile: string): Rule[] => ignoreFile
  .split('\n')
  .map(l => l.trim())
  .filter(l => !l.startsWith('#'))
  .map(l => l.startsWith('!')
    ? { exclude: true, pattern: l.split('!')[1] }
    : { include: true, pattern: l })

type Rule = {
  exclude?: true
  include?: true
  pattern: string
}

const printHelp = () => {
  console.log(`
Usage: ppurge [flags]

Options:

  --purge, -p             defaults to a dry run. will only delete files when this flag is provided
  --size, -s              compute file and directory sizes during file search. defaults to skip this so ppurge runs faster
  --root, -r              path to directory to use as root of file search. uses cwd when not provided
  --filter,-f             a semicolon seperated list of include/exclude rules to act as an inline .ppurge config
  --help                  shows this help message

`)
}


ppurge(parse(process.argv) as any).then(() => {
  process.exit(0)
}).catch((err) => {
  console.error(err)
  process.exit(1)
})