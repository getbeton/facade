import { Button } from "@/components/ui/button"
import { User } from "@supabase/supabase-js"

interface UserNavProps {
    user: User
}

export function UserNav({ user }: UserNavProps) {
    return (
        <div className="flex items-center gap-4">
            <div className="flex flex-col space-y-1">
                <p className="text-sm font-medium leading-none">{user.email}</p>
            </div>
            <form action="/auth/signout" method="post">
                <Button variant="outline" size="sm" type="submit">
                    Sign Out
                </Button>
            </form>
        </div>
    )
}
