import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

/**
 * Sign out route handler
 * This route signs out the user from Supabase auth and redirects to the home page
 */
export async function POST(request: Request) {
    const supabase = await createClient()

    // Sign out the user
    const { error } = await supabase.auth.signOut()

    if (error) {
        console.error('Error signing out:', error)
        return NextResponse.redirect(new URL('/dashboard', request.url))
    }

    // Redirect to home page after successful sign out
    return NextResponse.redirect(new URL('/', request.url))
}



