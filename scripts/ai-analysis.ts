// scripts/ai-analysis.ts
/**
 * Weekly AI Architecture Analysis
 * Analyzes entire repo for drift, inconsistencies, and improvements
 */

// CRITICAL: Load env FIRST, before any other imports
import { config } from "dotenv"
import path from "path"
import { fileURLToPath } from "url"

// Declare __filename and __dirname ONCE (lines 12-13)
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// Load .env.local BEFORE importing agents
config({ path: path.join(__dirname, "..", ".env.local") })

// NOW import everything else (after env is loaded)
import fs from "fs"
import { analyst, architect } from "../src/lib/ai/agents.js"

// ❌ DELETE LINES 22-23 if they look like this:
// const __filename = fileURLToPath(import.meta.url);  // ← DUPLICATE!
// const __dirname = path.dirname(__filename);         // ← DUPLICATE!

// Files to analyze
const IMPORTANT_FILES = [
  "src/app/layout.tsx",
  "src/app/page.tsx",
  "src/lib/supabase.js",
  "src/lib/indicators/keyLevels.ts",
  "src/app/(dashboard)/components/sentinels-overview.tsx",
  "src/app/(dashboard)/1watchlist/components/featured-tickers.tsx",
  "src/app/(dashboard)/1watchlist/components/previously-featured.tsx",
  "src/app/api/ingress/route.js",
  "src/app/api/levels/[symbol]/route.ts",
]

interface FileContent {
  path: string
  content: string
}

async function readFiles(projectRoot: string): Promise<FileContent[]> {
  const files: FileContent[] = []

  for (const filePath of IMPORTANT_FILES) {
    const fullPath = path.join(projectRoot, filePath)
    try {
      const content = fs.readFileSync(fullPath, "utf8")

      // Skip if file is too large (>3000 lines = likely generated/vendor code)
      const lineCount = content.split("\n").length
      if (lineCount > 3000) {
        console.warn(`⚠️  Skipping ${filePath} (${lineCount} lines, too large)`)
        continue
      }

      files.push({ path: filePath, content })
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : "Unknown error"
      console.warn(`⚠️  Could not read ${filePath}:`, errorMsg)
    }
  }

  return files
}

async function runAnalysis() {
  const projectRoot = path.join(__dirname, "..")
  console.log("📊 Starting AI architecture analysis...")

  // Read key files
  const files = await readFiles(projectRoot)
  console.log(`✓ Read ${files.length} files`)

  // Run repo-scale analysis
  const analysisResult = await analyst(
    files,
    `Analyze this Next.js financial dashboard:
    1. Identify architectural inconsistencies
    2. Find repeated patterns that should be abstracted
    3. Check for proper Server/Client component usage
    4. Spot potential data fetching issues
    5. Suggest improvements for maintainability

    Focus on high-level patterns, not minor code style.`
  )

  console.log("✓ Analyst complete")

  // Get architect's recommendations
  const recommendations = await architect(
    `Based on this analysis:\n\n${analysisResult.content}\n\n
    Provide 3-5 concrete action items to improve the codebase.
    Prioritize by impact and effort.`
  )

  console.log("✓ Architect recommendations complete")

  // Calculate total tokens
  const totalTokens =
    analysisResult.usage.prompt_tokens +
    analysisResult.usage.completion_tokens +
    recommendations.usage.prompt_tokens +
    recommendations.usage.completion_tokens

  // Generate report
  const report = `# AI Architecture Analysis Report
**Date:** ${new Date().toISOString()}

## Executive Summary
${analysisResult.content}

## Recommended Actions
${recommendations.content}

## Token Usage
- Analyst: ${analysisResult.usage.prompt_tokens + analysisResult.usage.completion_tokens} tokens
- Architect: ${recommendations.usage.prompt_tokens + recommendations.usage.completion_tokens} tokens
- **Total:** ${totalTokens} tokens

---
*Generated automatically by GitHub Actions*
`

  // Save report
  fs.writeFileSync(path.join(projectRoot, "ai-analysis-report.md"), report, "utf8")

  console.log("✅ Analysis complete! Report saved to ai-analysis-report.md")
}

runAnalysis().catch(console.error)
