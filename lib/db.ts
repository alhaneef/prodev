"use server"

import { neon } from "@neondatabase/serverless"

/**
 * Server-side Neon SQL client.
 * Usage:
 *   import { db } from '@/lib/db'
 *   const rows = await db`SELECT now()`
 */
const sql = neon(process.env.DATABASE_URL as string)

export const db = sql
