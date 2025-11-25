import { Suspense } from 'react'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { Header } from '@/components/header'
import { DashboardEmptyState } from '@/components/dashboard-empty-state'
import { DashboardSkeleton } from '@/components/dashboard-skeleton'

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

    // improved: fetch collections from DB
    // Assuming a 'collections' table exists. If not, this will fail gracefully or return empty.
    // We wrap in try/catch just in case the table doesn't exist yet.
    let collections = []
    try {
        const { data, error } = await supabase.from('collections').select('*')
        if (!error && data) {
            collections = data
        }
    } catch (e) {
        console.error("Failed to fetch collections", e)
    }

    if (collections.length === 0) {
        return <DashboardEmptyState />
    }

    return (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {collections.map((collection: any) => (
                <div key={collection.id} className="p-6 border rounded-lg shadow-sm">
                    <h3 className="font-semibold">{collection.name || 'Untitled Collection'}</h3>
                    <p className="text-sm text-muted-foreground">ID: {collection.id}</p>
                </div>
            ))}
        </div>
    )
}

