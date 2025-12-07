import { Suspense } from 'react'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { DashboardSkeleton } from '@/components/dashboard-skeleton'
import { DashboardSites } from '@/components/dashboard-sites'
import DevDashboard from '@/components/dev-dashboard' // Client Component

interface DashboardPageProps {
    searchParams: Promise<{ mode?: string }>;
}

export default async function DashboardPage({ searchParams }: DashboardPageProps) {
    const { mode } = await searchParams;
    
    // DEV MODE BYPASS
    if (mode === 'dev') {
        return <DevDashboard />;
    }

    const supabase = await createClient()

    const {
        data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
        redirect('/auth/login')
    }

    // Check for active integration
    const { data: integration } = await supabase
        .from('integrations')
        .select('id')
        .eq('user_id', user.id)
        .eq('status', 'active')
        .maybeSingle()

    if (!integration) {
        redirect('/connect')
    }

    // Fetch initial sites
    const { data: sites } = await supabase
        .from('sites')
        .select(`
            *,
            collections (*)
        `)
        .eq('integration_id', integration.id)
        .order('name');

    return (
        <div className="min-h-screen bg-background">
            {/* Header is now in layout */}
            <main className="container mx-auto py-10 px-4">
                <Suspense fallback={<DashboardSkeleton />}>
                    <DashboardSites 
                        integrationId={integration.id} 
                        initialSites={sites || []} 
                    />
                </Suspense>
            </main>
        </div>
    )
}
