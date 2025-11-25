import Link from "next/link"
import { UserNav } from "@/components/user-nav"
import { User } from "@supabase/supabase-js"

interface HeaderProps {
    user: User
}

export function Header({ user }: HeaderProps) {
    return (
        <header className="border-b">
            <div className="container mx-auto flex h-16 items-center px-4 justify-between">
                <div className="flex items-center gap-2 font-semibold">
                    <Link href="/dashboard">
                        Webflow Image Gen
                    </Link>
                </div>
                <div className="flex items-center gap-4">
                    <UserNav user={user} />
                </div>
            </div>
        </header>
    )
}
