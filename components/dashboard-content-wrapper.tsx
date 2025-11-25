'use client'

import { CollectionManagement } from '@/components/collection-management'

interface DashboardContentWrapperProps {
    keysValidated: boolean
}

/**
 * Wrapper component to handle client-side rendering of CollectionManagement
 * This is needed because server components can't directly render client components
 */
export function DashboardContentWrapper({ keysValidated }: DashboardContentWrapperProps) {
    return <CollectionManagement keysValidated={keysValidated} />
}


