import Link from "next/link"
import { Button } from "@/components/ui/button"
import { PlusCircle } from "lucide-react"

export function DashboardEmptyState() {
    return (
        <div className="flex flex-col items-center justify-center h-[50vh] space-y-4 border rounded-lg border-dashed p-8 text-center animate-in fade-in-50">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-secondary">
                <PlusCircle className="h-6 w-6 text-secondary-foreground" />
            </div>
            <div className="space-y-2">
                <h3 className="text-lg font-medium">No collections linked</h3>
                <p className="text-sm text-muted-foreground max-w-sm mx-auto">
                    Link a Webflow collection to start generating OG images.
                </p>
            </div>
            <Link href="/new">
                <Button>
                    Link New Collection
                </Button>
            </Link>
        </div>
    )
}
