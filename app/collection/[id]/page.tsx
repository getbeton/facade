import { Suspense } from 'react'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { CollectionItems } from '@/components/collection-items'
import { DashboardSkeleton } from '@/components/dashboard-skeleton'

interface CollectionPageProps {
    params: Promise<{
        id: string
    }>
}

export default async function CollectionPage({ params }: CollectionPageProps) {
    const { id } = await params
    const supabase = await createClient()

    const {
        data: { user },
    } = await supabase.auth.getUser()

    // if (!user) {
    //     return redirect('/auth/login')
    // }

    // Mock user for dev
    const activeUser = user || { id: '733fa455-3a6d-47bd-8ab4-216cf3a5ee66', email: 'dev@example.com' }

    return (
        <div className="min-h-screen bg-background">
            {/* Header is in layout */}
            <main className="container mx-auto py-10 px-4">
                <Suspense fallback={<DashboardSkeleton />}>
                    <CollectionItems collectionId={id} />
                </Suspense>
            </main>
        </div>
    )
}





