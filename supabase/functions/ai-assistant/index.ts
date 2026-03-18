import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import Anthropic from 'https://esm.sh/@anthropic-ai/sdk@0.39.0'

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
}

function jsonResponse(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  })
}

function buildSystemPrompt(context: Record<string, unknown>): string {
  const parts: string[] = []

  parts.push(
    "You are a personal AI assistant integrated into Life OS — a fitness, nutrition, and goals app. " +
    "You are warm, knowledgeable, and personalized — like a real trainer or nutritionist in a consultation. No emojis.\n\n" +
    "CONVERSATION STYLE:\n" +
    "- When someone asks you to build a program, plan meals, or set goals — introduce yourself briefly and walk them through the process step by step.\n" +
    "- No small talk. No 'how's your day.' Get straight into the consultation.\n" +
    "- Use what you already know from their profile — don't re-ask things you already have.\n" +
    "- Keep responses concise. No walls of text.\n" +
    "- For quick questions (what should I eat, how was my week) — answer directly, no consultation needed.\n\n" +
    "PROGRAM BUILDING CONSULTATION (follow this sequence):\n" +
    "When asked to build a workout program, gather this info through focused questions ONE AT A TIME before building anything:\n\n" +
    "1. GOALS — What specifically are you training for? (muscle gain, fat loss, strength, athletic performance, general fitness, a specific event?) What does success look like to you?\n" +
    "2. TRAINING HISTORY — Have you followed a structured program before? What did it look like? What worked, what didn't?\n" +
    "3. WEAK POINTS & PRIORITIES — Any muscle groups you want to emphasize? Any areas you feel are lagging or you want to bring up?\n" +
    "4. TIME & LIFESTYLE — How much time can you spend per session? Morning or evening? How active is your job/daily life outside the gym?\n" +
    "5. PREFERENCES — Any exercises you love? Any you hate or want to avoid? Preference for free weights vs machines vs cables?\n\n" +
    "After gathering answers to ALL 5, summarize what you heard back to them, then build a complete program with clear reasoning for every choice — why this split, why these exercises, why this rep range.\n\n" +
    "Do NOT build the program until you've asked all 5 questions. Ask them one at a time across multiple messages."
  )

  // User profile
  if (context.userName) {
    parts.push(`User's name: ${context.userName}.`)
  }
  if (context.age) {
    parts.push(`Age: ${context.age}.`)
  }
  if (context.weight) {
    parts.push(`Weight: ${context.weight} lbs.`)
  }

  // Difficulty
  if (context.difficulty) {
    const descriptions: Record<string, string> = {
      easy: "The user prefers an easy difficulty — 3 workout days/week, simple meals, gentle accountability.",
      medium: "The user prefers medium difficulty — 4 workout days/week, moderate meal complexity, balanced accountability.",
      hard: "The user prefers hard difficulty — 6 workout days/week, advanced meals, strict accountability.",
    }
    parts.push(descriptions[context.difficulty as string] || `Difficulty: ${context.difficulty}.`)
  }

  // Food preferences
  if (context.foodPreferences) {
    const prefs = context.foodPreferences as Record<string, unknown>
    if (prefs.liked) parts.push(`Foods they like: ${prefs.liked}.`)
    if (prefs.disliked) parts.push(`Foods they dislike: ${prefs.disliked}.`)
    if (prefs.restrictions) parts.push(`Dietary restrictions: ${prefs.restrictions}.`)
    if (prefs.cookingLevel) parts.push(`Cooking skill level: ${prefs.cookingLevel}.`)
  }

  // Fitness info
  if (context.fitnessExperience) {
    parts.push(`Fitness experience: ${context.fitnessExperience}.`)
  }
  if (context.todaysWorkout) {
    const w = context.todaysWorkout as Record<string, unknown>
    parts.push(`Today's workout: ${w.name || w.focus || "scheduled"}.`)
    if (w.exercises && Array.isArray(w.exercises)) {
      const names = w.exercises.map((e: Record<string, unknown>) => e.exercise_name).join(", ")
      parts.push(`Exercises: ${names}.`)
    }
  }

  // Today's meals
  if (context.todaysMeals && Array.isArray(context.todaysMeals) && context.todaysMeals.length > 0) {
    const mealSummary = context.todaysMeals
      .map((m: Record<string, unknown>) => `${m.meal_type}: ${m.name} (${m.calories || "?"} cal)`)
      .join("; ")
    parts.push(`Meals logged today: ${mealSummary}.`)
  }

  // Active goals
  if (context.activeGoals && Array.isArray(context.activeGoals) && context.activeGoals.length > 0) {
    const goalSummary = context.activeGoals
      .map((g: Record<string, unknown>) => `${g.title} (${g.progress || 0}% done)`)
      .join("; ")
    parts.push(`Active goals: ${goalSummary}.`)
  }

  // Daily state
  if (context.energy) {
    parts.push(`Energy level today: ${context.energy}.`)
  }
  if (context.sleepQuality) {
    parts.push(`Sleep quality: ${context.sleepQuality} (${context.sleepHours || "?"} hours).`)
  }

  // Structured output instructions
  parts.push(
    "\n--- Structured Output Rules ---\n" +
    "When you suggest a recipe, include a JSON code block with the recipe data:\n" +
    "```json\n" +
    '{ "type": "suggest_recipe", "recipe": { "name": "...", "description": "...", "calories": 0, "protein": 0, "carbs": 0, "fat": 0, "prep_time_min": 0, "cook_time_min": 0, "servings": 0, "ingredients": ["..."], "instructions": ["..."] } }\n' +
    "```\n" +
    "When you suggest a fitness program, include a JSON code block:\n" +
    "```json\n" +
    '{ "type": "create_program", "program": { "name": "...", "days": [{ "day_of_week": 0, "name": "...", "focus": "...", "is_rest_day": false, "exercises": [{ "name": "...", "sets": 3, "reps_min": 8, "reps_max": 12, "rest": 90 }] }] } }\n' +
    "```\n" +
    "Only include JSON code blocks for actionable suggestions the user can save. Do not include JSON for regular conversation."
  )

  return parts.join("\n")
}

function extractActions(text: string): Record<string, unknown>[] {
  const actions: Record<string, unknown>[] = []
  const regex = /```json\s*([\s\S]*?)```/g
  let match

  while ((match = regex.exec(text)) !== null) {
    try {
      const parsed = JSON.parse(match[1].trim())
      if (parsed && parsed.type) {
        actions.push(parsed)
      }
    } catch {
      // Skip malformed JSON blocks
    }
  }

  return actions
}

Deno.serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders })
  }

  try {
    // 1. Validate auth
    const authHeader = req.headers.get("Authorization")
    if (!authHeader) {
      return jsonResponse({ error: "Missing authorization header" }, 401)
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    )

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return jsonResponse({ error: "Unauthorized" }, 401)
    }

    // 2. Parse request body
    const { message, context, conversationHistory, difficulty } = await req.json()

    if (!message || typeof message !== "string") {
      return jsonResponse({ error: "Message is required" }, 400)
    }

    // 3. Build system prompt
    const systemPrompt = buildSystemPrompt({ ...context, difficulty })

    // 4. Build messages array for Claude
    const chatMessages: { role: string; content: string }[] = []

    if (conversationHistory && Array.isArray(conversationHistory)) {
      for (const msg of conversationHistory) {
        chatMessages.push({ role: msg.role, content: msg.content })
      }
    }

    chatMessages.push({ role: "user", content: message })

    // 5. Call Claude
    const anthropic = new Anthropic({
      apiKey: Deno.env.get("ANTHROPIC_API_KEY")!,
    })

    const completion = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 2000,
      system: systemPrompt,
      messages: chatMessages,
    })

    const assistantMessage = completion.content
      .filter((block: { type: string }) => block.type === "text")
      .map((block: { type: string; text: string }) => block.text)
      .join("")

    // 6. Extract actions from response
    const actions = extractActions(assistantMessage)

    // 7. Save messages to v2_ai_conversations
    const now = new Date().toISOString()

    const adminSupabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    )

    await adminSupabase.from("v2_ai_conversations").insert([
      { user_id: user.id, role: "user", content: message, created_at: now },
      { user_id: user.id, role: "assistant", content: assistantMessage, created_at: now },
    ])

    // 8. Prune to last 20 messages per user
    const { data: allMessages } = await adminSupabase
      .from("v2_ai_conversations")
      .select("id")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })

    if (allMessages && allMessages.length > 20) {
      const idsToDelete = allMessages.slice(20).map((m: { id: string }) => m.id)

      if (idsToDelete.length > 0) {
        await adminSupabase
          .from("v2_ai_conversations")
          .delete()
          .in("id", idsToDelete)
      }
    }

    // 9. Return response
    return jsonResponse({ message: assistantMessage, actions })
  } catch (err) {
    console.error("ai-assistant error:", err)
    return jsonResponse({ error: "Internal server error" }, 500)
  }
})
