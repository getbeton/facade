import { Suspense } from 'react'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { Header } from '@/components/header'
import { DashboardSkeleton } from '@/components/dashboard-skeleton'
import { DashboardCollections } from '@/components/dashboard-collections'

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
                <Suspense fallback={<DashboardSkeleton />}>
                    <DashboardCollections />
                </Suspense>
            </main>
        </div>
    )
}
