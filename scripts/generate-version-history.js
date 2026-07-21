#!/usr/bin/env node
/**
 * ponytail: 构建/开发时从 RELEASE_NOTES.md 生成版本历史 JSON
 * 确保前端版本历史与发布说明自动同步，避免手动维护两份数据。
 */

import { readFileSync, writeFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(__dirname, '..')
const RELEASE_NOTES = resolve(ROOT, 'RELEASE_NOTES.md')
const OUTPUT = resolve(ROOT, 'src/version-history.json')

function parseReleaseNotes(content) {
  const lines = content.split('\n')
  const versions = []
  let currentVersion = null
  let currentChanges = []

  for (const line of lines) {
    const versionMatch = line.match(/^##\s+(v?\d+\.\d+\.\d+)/)
    if (versionMatch) {
      if (currentVersion) {
        versions.push({ version: currentVersion, changes: currentChanges.filter(Boolean) })
      }
      currentVersion = versionMatch[1].replace(/^v/, '')
      currentChanges = []
    } else if (currentVersion) {
      const changeMatch = line.match(/^-\s+(.+)/)
      if (changeMatch) {
        currentChanges.push(changeMatch[1].trim())
      }
    }
  }

  // 添加最后一个版本
  if (currentVersion) {
    versions.push({ version: currentVersion, changes: currentChanges.filter(Boolean) })
  }

  return versions
}

try {
  const content = readFileSync(RELEASE_NOTES, 'utf-8')
  const history = parseReleaseNotes(content)
  writeFileSync(OUTPUT, JSON.stringify(history, null, 2))
  console.log(`✓ Generated ${OUTPUT} with ${history.length} versions`)
} catch (err) {
  console.error('✗ Failed to generate version history:', err.message)
  process.exit(1)
}