import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { Button } from '@/components/ui/button'

export default async function DashboardPage() {
    const supabase = await createClient()

    const {
        data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
        return redirect('/auth/login')
    }

    return (
        <div className="container mx-auto py-10">
            <div className="flex justify-between items-center mb-8">
                <h1 className="text-3xl font-bold">Dashboard</h1>
                <form action="/auth/signout" method="post">
                    <Button variant="outline" type="submit">
                        Sign Out
                    </Button>
                </form>
            </div>

            <div className="grid gap-4">
                <div className="p-6 border rounded-lg shadow-sm">
                    <h2 className="text-xl font-semibold mb-2">Welcome back!</h2>
                    <p className="text-muted-foreground">
                        You are logged in as {user.email}
                    </p>
                </div>
            </div>
        </div>
    )
}
