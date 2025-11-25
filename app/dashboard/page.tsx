import { Suspense } from 'react'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { Header } from '@/components/header'
import { DashboardEmptyState } from '@/components/dashboard-empty-state'
import { DashboardSkeleton } from '@/components/dashboard-skeleton'
import { DashboardContentWrapper } from '@/components/dashboard-content-wrapper'

export default async function DashboardPage() {
    const supabase = await createClient()

    const {
        data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
        return redirect('/auth/login')
    }

    return (
        <div className="min-h-screen bg-background">
            <Header user={user} />
            <main className="container mx-auto py-10 px-4">
                <div className="mb-8">
                    <h1 className="text-3xl font-bold">Dashboard</h1>
                    <p className="text-muted-foreground">Manage your Webflow collections and image generations.</p>
                </div>

                <Suspense fallback={<DashboardSkeleton />}>
                    <DashboardContent />
                </Suspense>
            </main>
        </div>
    )
}

async function DashboardContent() {
    const supabase = await createClient()
    
    // Get the current user
    const { data: { user } } = await supabase.auth.getUser()
    
    if (!user) {
        return <DashboardEmptyState />
    }

    // Check if user has API keys saved
    const { data: keysData, error: keysError } = await supabase
        .from('user_api_keys')
        .select('keys_validated, last_validated_at')
        .eq('user_id', user.id)
        .single()

    // If no API keys found, show empty state
    if (keysError || !keysData) {
        return <DashboardEmptyState />
    }

    // User has API keys saved - show collection management UI
    return <DashboardContentWrapper keysValidated={keysData.keys_validated} />
}

