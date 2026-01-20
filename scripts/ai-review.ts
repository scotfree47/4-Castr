// scripts/ai-review.ts
/**
 * Interactive code review CLI
 * Usage: npm run ai:review <filepath>
 */

// CRITICAL: Load env FIRST
import { config } from "dotenv"
import path from "path"
import { fileURLToPath } from "url"

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// Load .env.local BEFORE importing agents
config({ path: path.join(__dirname, "..", ".env.local") })

// NOW import everything else
import fs from "fs"
import { reviewer, coder } from "../src/lib/ai/agents.js"

async function reviewFile(filePath: string): Promise<void> {
  const fullPath = path.join(__dirname, "..", filePath)

  if (!fs.existsSync(fullPath)) {
    console.error(`❌ File not found: ${filePath}`)
    process.exit(1)
  }

  const code = fs.readFileSync(fullPath, "utf8")
  console.log(`🔍 Reviewing ${filePath}...`)

  // Step 1: Review
  const review = await reviewer(code, `File: ${filePath}`)
  console.log("\n📋 REVIEW:\n")
  console.log(review.content)

  // Step 2: Generate fixes if --auto flag
  if (process.env.CI || process.argv.includes("--auto")) {
    console.log("\n💡 Generating fixes...")
    const fixes = await coder(`Fix all issues from this review:\n${review.content}`, code)

    console.log("\n🔧 SUGGESTED FIXES:\n")
    console.log(fixes.content)

    // Save to .ai-fixes.md
    const reportPath = path.join(__dirname, "..", ".ai-fixes.md")
    fs.writeFileSync(
      reportPath,
      `# AI Review: ${filePath}\n\n## Review\n${review.content}\n\n## Fixes\n${fixes.content}`,
      "utf8"
    )
    console.log(`\n✅ Saved to ${reportPath}`)
  }
}

const targetFile = process.argv[2] || "src/app/page.tsx"
reviewFile(targetFile).catch((err) => {
  console.error("❌ Review failed:", err instanceof Error ? err.message : err)
  process.exit(1)
})
