// Quick script to check astro_aspects table
import { createClient } from "@supabase/supabase-js"
import dotenv from "dotenv"
import path from "path"
import { fileURLToPath } from "url"

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const projectRoot = path.resolve(__dirname, "..")

dotenv.config({ path: path.join(projectRoot, ".env.local") })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

async function check() {
  console.log("Checking astro_aspects table...\n")

  const { count, error } = await supabase
    .from("astro_aspects")
    .select("*", { count: "exact", head: true })

  if (error) {
    console.log("❌ Error:", error.message)
    return
  }

  console.log(`✅ astro_aspects: ${count?.toLocaleString()} rows\n`)

  if (count && count > 0) {
    // Sample rows
    const { data } = await supabase
      .from("astro_aspects")
      .select("date, body1, body2, aspect_type, aspect_nature, orb, exact")
      .order("date", { ascending: false })
      .limit(5)

    console.log("Recent aspect rows:")
    console.table(data)
  }
}

check()
