"use client"

import * as React from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { UserNav } from "@/components/user-nav"
import { BetonLogo } from "@/components/icons"
import { User } from "@supabase/supabase-js"
import {
    Breadcrumb,
    BreadcrumbList,
    BreadcrumbItem,
    BreadcrumbLink,
    BreadcrumbPage,
    BreadcrumbSeparator,
} from "@/components/ui/breadcrumb"

interface MainHeaderProps {
    user: User
}

export function MainHeader({ user }: MainHeaderProps) {
    const pathname = usePathname()

    // Helper to generate breadcrumbs based on path
    const getBreadcrumbs = () => {
        const paths = pathname.split('/').filter(p => p);
        
        // Base case: Home/Dashboard
        const crumbs = [
            { label: 'Home', href: '/' }
        ];

        // Specific mapping logic
        // This is a simplified version. For a production app with dynamic segments like [id],
        // we might want to fetch names or use a more robust context/state.
        // For now, we map known segments.
        
        let currentPath = '';

        paths.forEach((segment, index) => {
            currentPath += `/${segment}`;
            
            // Skip "dashboard" if it's the home in this context, or handle it as "Dashboard"
            if (segment === 'dashboard' && index === 0) {
                 crumbs.push({ label: 'Dashboard', href: currentPath });
                 return;
            }

             if (segment === 'connect') {
                 crumbs.push({ label: 'Connect Stack', href: currentPath });
                 return;
            }

            if (segment === 'collection' && paths[index + 1]) {
                // Handle collection base
                crumbs.push({ label: 'Collection', href: currentPath });
                return;
            }
            
            // If it's an ID (simple heuristic: long or numeric)
            // Ideally we'd have the collection name passed down or fetched. 
            // For now, we just don't show the ID as a crumb label or show "Details"
            // If previous segment was collection, this is the ID
            if (paths[index - 1] === 'collection') {
                 crumbs.push({ label: 'Details', href: currentPath });
                 return;
            }

            // Default fallback
            const label = segment.charAt(0).toUpperCase() + segment.slice(1);
            crumbs.push({ label: label, href: currentPath });
        });

        return crumbs;
    };

    const breadcrumbs = getBreadcrumbs();

    return (
        <header className="border-b bg-background">
            <div className="container mx-auto flex h-16 items-center px-4 justify-between">
                <div className="flex items-center gap-6">
                    {/* Logo */}
                    <Link href="/dashboard" className="flex items-center gap-2 text-foreground hover:opacity-80 transition-opacity">
                        <BetonLogo className="h-6 w-6" />
                        <span className="font-bold hidden sm:inline-block">Beton</span>
                    </Link>

                    {/* Separator */}
                    <div className="h-6 w-px bg-border hidden sm:block" />

                    {/* Breadcrumbs */}
                    <Breadcrumb className="hidden sm:block">
                        <BreadcrumbList>
                            {breadcrumbs.map((crumb, index) => {
                                const isLast = index === breadcrumbs.length - 1;
                                
                                return (
                                    <React.Fragment key={crumb.href}>
                                        <BreadcrumbItem>
                                            {isLast ? (
                                                <BreadcrumbPage>{crumb.label}</BreadcrumbPage>
                                            ) : (
                                                <BreadcrumbLink asChild>
                                                    <Link href={crumb.href}>{crumb.label}</Link>
                                                </BreadcrumbLink>
                                            )}
                                        </BreadcrumbItem>
                                        {!isLast && <BreadcrumbSeparator />}
                                    </React.Fragment>
                                );
                            })}
                        </BreadcrumbList>
                    </Breadcrumb>
                </div>

                {/* Right Actions */}
                <div className="flex items-center gap-4">
                    <UserNav user={user} />
                </div>
            </div>
        </header>
    )
}

