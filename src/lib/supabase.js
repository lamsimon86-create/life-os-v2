import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://ezzhugoodmvfxaumpioo.supabase.co'
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV6emh1Z29vZG12ZnhhdW1waW9vIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM3NzAwNjcsImV4cCI6MjA4OTM0NjA2N30.-BcIVLvQHSicmpjToyuB86j4znGLWgJRfxre2-7FNdY'

export const supabase = createClient(supabaseUrl, supabaseKey)
