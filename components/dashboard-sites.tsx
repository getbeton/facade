'use client';

import { useState } from 'react';
import { Site, Collection } from '@/lib/types';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2, RefreshCw, ArrowRight, ExternalLink } from 'lucide-react';
import Link from 'next/link';

interface DashboardSitesProps {
    integrationId: string;
    initialSites: (Site & { collections: Collection[] })[];
}

export function DashboardSites({ integrationId, initialSites }: DashboardSitesProps) {
    const [sites, setSites] = useState(initialSites);
    const [scanningSiteId, setScanningSiteId] = useState<string | null>(null);

    async function handleScanSite(siteId: string) {
        setScanningSiteId(siteId);
        try {
            const res = await fetch('/api/scan', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ integrationId, siteId }),
            });
            
            if (res.ok) {
                const data = await res.json();
                // Update local state with new collections
                setSites(current => current.map(site => {
                    if (site.id === siteId) {
                        return { ...site, collections: data.collections };
                    }
                    return site;
                }));
            }
        } catch (error) {
            console.error('Scan failed:', error);
        } finally {
            setScanningSiteId(null);
        }
    }

    return (
        <div className="space-y-8">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-2xl font-bold tracking-tight">Your Sites</h2>
                    <p className="text-muted-foreground">
                        Select a collection to start generating images.
                    </p>
                </div>
                <Button variant="outline" onClick={() => window.location.reload()}>
                    <RefreshCw className="mr-2 h-4 w-4" />
                    Refresh
                </Button>
            </div>

            <div className="grid gap-6">
                {sites.map((site) => (
                    <Card key={site.id} className="overflow-hidden">
                        <div className="border-b bg-muted/40 p-4 flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                {site.favicon_url && (
                                    <img src={site.favicon_url} alt="" className="h-6 w-6 rounded-sm" />
                                )}
                                <div>
                                    <h3 className="font-semibold">{site.name}</h3>
                                    {site.preview_url && (
                                        <a 
                                            href={site.preview_url} 
                                            target="_blank" 
                                            rel="noreferrer"
                                            className="text-xs text-muted-foreground hover:underline flex items-center"
                                        >
                                            {site.short_name}
                                            <ExternalLink className="ml-1 h-3 w-3" />
                                        </a>
                                    )}
                                </div>
                            </div>
                            <Button 
                                size="sm" 
                                variant="secondary"
                                disabled={scanningSiteId === site.id}
                                onClick={() => handleScanSite(site.id)}
                            >
                                {scanningSiteId === site.id ? (
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                    'Scan for Collections'
                                )}
                            </Button>
                        </div>
                        
                        <CardContent className="p-0">
                            {site.collections && site.collections.length > 0 ? (
                                <div className="divide-y">
                                    {site.collections.map(col => (
                                        <div key={col.id} className="flex items-center justify-between p-4 hover:bg-muted/50 transition-colors">
                                            <div>
                                                <h4 className="font-medium">{col.display_name}</h4>
                                                <p className="text-sm text-muted-foreground">
                                                    ID: {col.webflow_collection_id}
                                                </p>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <Link href={`/collection/${col.id}`}>
                                                    <Button size="sm">
                                                        Manage Images
                                                        <ArrowRight className="ml-2 h-4 w-4" />
                                                    </Button>
                                                </Link>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className="p-8 text-center text-muted-foreground text-sm">
                                    No collections found. Click "Scan" to find them.
                                </div>
                            )}
                        </CardContent>
                    </Card>
                ))}
            </div>
        </div>
    );
}


