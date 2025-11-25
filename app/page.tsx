'use client';

import { useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
    Select,
    SelectTrigger,
    SelectValue,
    SelectPopup,
    SelectItem,
} from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import {
    Card,
    CardHeader,
    CardTitle,
    CardDescription,
    CardPanel,
} from '@/components/ui/card';
import { Field, FieldLabel } from '@/components/ui/field';
import {
    Table,
    TableHeader,
    TableBody,
    TableRow,
    TableHead,
    TableCell,
} from '@/components/ui/table';
import { WebflowSite, WebflowCollection, WebflowCollectionItem } from '@/lib/types';

export default function Home() {
    // API Keys
    const [webflowApiKey, setWebflowApiKey] = useState('');
    const [openaiApiKey, setOpenaiApiKey] = useState('');
    const [webflowValid, setWebflowValid] = useState<boolean | null>(null);
    const [openaiValid, setOpenaiValid] = useState<boolean | null>(null);

    // Sites & Collections
    const [sites, setSites] = useState<WebflowSite[]>([]);
    const [selectedSite, setSelectedSite] = useState('');
    const [collections, setCollections] = useState<WebflowCollection[]>([]);
    const [selectedCollection, setSelectedCollection] = useState('');

    // Items & Table
    const [items, setItems] = useState<WebflowCollectionItem[]>([]);
    const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
    const [editingCell, setEditingCell] = useState<{ itemId: string; field: string } | null>(null);
    const [editValue, setEditValue] = useState('');

    // Search & Filter
    const [searchTerm, setSearchTerm] = useState('');
    const [sortColumn, setSortColumn] = useState<string>('');
    const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');

    // Generation
    const [isGenerating, setIsGenerating] = useState(false);
    const [progress, setProgress] = useState(0);
    const [total, setTotal] = useState(0);
    const [currentItem, setCurrentItem] = useState('');
    const [statusMessage, setStatusMessage] = useState('');
    const [error, setError] = useState('');

    const validateWebflow = async () => {
        if (!webflowApiKey) return;

        setWebflowValid(null);
        try {
            const res = await fetch('/api/validate-webflow', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ apiKey: webflowApiKey }),
            });
            const data = await res.json();
            setWebflowValid(data.valid);

            if (data.valid) {
                // Fetch sites
                const sitesRes = await fetch('/api/sites', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ apiKey: webflowApiKey }),
                });
                const sitesData = await sitesRes.json();
                setSites(sitesData.sites || []);
            }
        } catch {
            setWebflowValid(false);
        }
    };

    const validateOpenAI = async () => {
        if (!openaiApiKey) return;

        setOpenaiValid(null);
        try {
            const res = await fetch('/api/validate-openai', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ apiKey: openaiApiKey }),
            });
            const data = await res.json();
            setOpenaiValid(data.valid);
        } catch {
            setOpenaiValid(false);
        }
    };

    const loadCollections = async (siteId: string) => {
        try {
            const res = await fetch('/api/collections', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ apiKey: webflowApiKey, siteId }),
            });
            const data = await res.json();
            setCollections(data.collections || []);
        } catch (err) {
            console.error('Failed to load collections:', err);
        }
    };

    const loadItems = async (collectionId: string) => {
        try {
            const res = await fetch('/api/items', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ apiKey: webflowApiKey, collectionId }),
            });
            const data = await res.json();
            setItems(data.items || []);
            setSelectedItems(new Set());
        } catch (err) {
            console.error('Failed to load items:', err);
        }
    };

    const handleSiteSelect = (siteId: string) => {
        setSelectedSite(siteId);
        setCollections([]);
        setSelectedCollection('');
        setItems([]);
        if (siteId) {
            loadCollections(siteId);
        }
    };

    const handleCollectionSelect = (collectionId: string) => {
        setSelectedCollection(collectionId);
        setItems([]);
        if (collectionId) {
            loadItems(collectionId);
        }
    };

    const toggleItemSelection = (itemId: string) => {
        const newSelection = new Set(selectedItems);
        if (newSelection.has(itemId)) {
            newSelection.delete(itemId);
        } else {
            newSelection.add(itemId);
        }
        setSelectedItems(newSelection);
    };

    const toggleSelectAll = () => {
        if (selectedItems.size === filteredItems.length) {
            setSelectedItems(new Set());
        } else {
            setSelectedItems(new Set(filteredItems.map(item => item.id)));
        }
    };

    const startEditing = (itemId: string, field: string, currentValue: any) => {
        setEditingCell({ itemId, field });
        setEditValue(String(currentValue || ''));
    };

    const saveEdit = async () => {
        if (!editingCell) return;

        try {
            await fetch('/api/items/update', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    apiKey: webflowApiKey,
                    collectionId: selectedCollection,
                    itemIds: [editingCell.itemId],
                    fieldName: editingCell.field,
                    value: editValue,
                    singleItem: true,
                }),
            });

            // Update local state
            setItems(items.map(item =>
                item.id === editingCell.itemId
                    ? { ...item, fieldData: { ...item.fieldData, [editingCell.field]: editValue } }
                    : item
            ));

            setEditingCell(null);
        } catch (err) {
            console.error('Failed to save edit:', err);
        }
    };

    const cancelEdit = () => {
        setEditingCell(null);
        setEditValue('');
    };

    const bulkDelete = async () => {
        if (selectedItems.size === 0) return;

        if (!confirm(`Delete ${selectedItems.size} items? This cannot be undone.`)) {
            return;
        }

        try {
            await fetch('/api/items/delete', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    apiKey: webflowApiKey,
                    collectionId: selectedCollection,
                    itemIds: Array.from(selectedItems),
                }),
            });

            // Reload items
            loadItems(selectedCollection);
        } catch (err) {
            console.error('Failed to delete items:', err);
        }
    };

    const generateImages = async () => {
        if (selectedItems.size === 0) return;

        setIsGenerating(true);
        setError('');
        setProgress(0);
        setTotal(0);
        setCurrentItem('');
        setStatusMessage('Starting image generation...');

        try {
            const res = await fetch('/api/generate-images', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    webflowApiKey,
                    openaiApiKey,
                    collectionId: selectedCollection,
                    siteId: selectedSite,
                    itemIds: Array.from(selectedItems),
                }),
            });

            if (!res.body) throw new Error('No response body');

            const reader = res.body.getReader();
            const decoder = new TextDecoder();

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                const chunk = decoder.decode(value);
                const lines = chunk.split('\n').filter((line) => line.trim());

                for (const line of lines) {
                    try {
                        const data = JSON.parse(line);

                        if (data.total) setTotal(data.total);
                        if (data.progress !== undefined) {
                            setProgress(data.progress);
                            if (data.total) {
                                const percentage = Math.round((data.progress / data.total) * 100);
                                statusMessage && setStatusMessage(`${percentage}% complete (${data.progress}/${data.total})`);
                            }
                        }
                        if (data.currentItem) setCurrentItem(data.currentItem);
                        if (data.message) setStatusMessage(data.message);
                        if (data.status === 'error') setError(data.message || 'An error occurred');
                    } catch {
                        // Ignore JSON parse errors
                    }
                }
            }

            setIsGenerating(false);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'An error occurred');
            setIsGenerating(false);
        }
    };

    // Get all unique field names from items
    const fieldNames = useMemo(() => {
        if (items.length === 0) return [];
        const fields = new Set<string>();
        items.forEach(item => {
            Object.keys(item.fieldData).forEach(key => fields.add(key));
        });
        return Array.from(fields);
    }, [items]);

    // Filter and sort items
    const filteredItems = useMemo(() => {
        let filtered = items;

        // Search
        if (searchTerm) {
            filtered = filtered.filter(item =>
                Object.values(item.fieldData).some(value =>
                    String(value).toLowerCase().includes(searchTerm.toLowerCase())
                )
            );
        }

        // Sort
        if (sortColumn) {
            filtered = [...filtered].sort((a, b) => {
                const aVal = String(a.fieldData[sortColumn] || '');
                const bVal = String(b.fieldData[sortColumn] || '');
                const comparison = aVal.localeCompare(bVal);
                return sortDirection === 'asc' ? comparison : -comparison;
            });
        }

        return filtered;
    }, [items, searchTerm, sortColumn, sortDirection]);

    const toggleSort = (column: string) => {
        if (sortColumn === column) {
            setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
        } else {
            setSortColumn(column);
            setSortDirection('asc');
        }
    };

    const selectedSiteData = sites.find(s => s.id === selectedSite);
    const selectedCollectionData = collections.find(c => c.id === selectedCollection);

    return (
        <main className="min-h-screen p-8 bg-gradient-to-br from-background to-secondary">
            <div className="max-w-7xl mx-auto space-y-6">
                <div className="text-center space-y-2">
                    <h1 className="text-4xl font-bold">Webflow CMS Manager</h1>
                    <p className="text-muted-foreground">
                        Manage your CMS items and generate AI-powered OG images
                    </p>
                </div>

                {/* Step 1: API Keys */}
                <Card>
                    <CardHeader>
                        <CardTitle>Step 1: API Configuration</CardTitle>
                        <CardDescription>
                            Enter your API keys to get started. Keys are not stored.
                        </CardDescription>
                    </CardHeader>
                    <CardPanel className="space-y-4">
                        {/* Webflow API Key */}
                        <Field className="space-y-2">
                            <FieldLabel>Webflow API Token</FieldLabel>
                            <div className="flex gap-2">
                                <Input
                                    type="password"
                                    placeholder="Enter Webflow API token"
                                    value={webflowApiKey}
                                    onChange={(e) => {
                                        setWebflowApiKey(e.target.value);
                                        setWebflowValid(null);
                                    }}
                                    className={webflowValid === true ? "border-green-500" : webflowValid === false ? "border-destructive" : ""}
                                />
                                <Button onClick={validateWebflow} disabled={!webflowApiKey}>
                                    Validate
                                </Button>
                            </div>
                            {webflowValid === true && (
                                <p className="text-sm text-green-600">✓ Valid</p>
                            )}
                            {webflowValid === false && (
                                <p className="text-sm text-destructive">✗ Invalid</p>
                            )}
                        </Field>

                        {/* OpenAI API Key */}
                        <Field className="space-y-2">
                            <FieldLabel>OpenAI API Key</FieldLabel>
                            <div className="flex gap-2">
                                <Input
                                    type="password"
                                    placeholder="Enter OpenAI API key"
                                    value={openaiApiKey}
                                    onChange={(e) => {
                                        setOpenaiApiKey(e.target.value);
                                        setOpenaiValid(null);
                                    }}
                                    className={openaiValid === true ? "border-green-500" : openaiValid === false ? "border-destructive" : ""}
                                />
                                <Button onClick={validateOpenAI} disabled={!openaiApiKey}>
                                    Validate
                                </Button>
                            </div>
                            {openaiValid === true && (
                                <p className="text-sm text-green-600">✓ Valid</p>
                            )}
                            {openaiValid === false && (
                                <p className="text-sm text-destructive">✗ Invalid</p>
                            )}
                        </Field>
                    </CardPanel>
                </Card>

                {/* Step 2: Site Selection */}
                {webflowValid && sites.length > 0 && (
                    <Card>
                        <CardHeader>
                            <CardTitle>Step 2: Select Site</CardTitle>
                            <CardDescription>
                                Choose the Webflow site you want to manage
                            </CardDescription>
                        </CardHeader>
                        <CardPanel>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {sites.map((site) => (
                                    <Card
                                        key={site.id}
                                        className={`cursor-pointer transition-all ${selectedSite === site.id
                                            ? 'ring-2 ring-primary'
                                            : 'hover:border-primary/50'
                                            }`}
                                        onClick={() => handleSiteSelect(site.id)}
                                    >
                                        <CardPanel className="p-4">
                                            <div className="flex items-start justify-between">
                                                <div className="space-y-1">
                                                    <h3 className="font-semibold">{site.displayName}</h3>
                                                    <p className="text-sm text-muted-foreground">{site.shortName}</p>
                                                    <p className="text-xs text-muted-foreground font-mono">ID: {site.id}</p>
                                                    {site.customDomains && site.customDomains.length > 0 && (
                                                        <p className="text-xs text-blue-600">{site.customDomains[0].url}</p>
                                                    )}
                                                </div>
                                                {selectedSite === site.id && (
                                                    <div className="text-primary">✓</div>
                                                )}
                                            </div>
                                        </CardPanel>
                                    </Card>
                                ))}
                            </div>
                        </CardPanel>
                    </Card>
                )}

                {/* Step 3: Collection Selection */}
                {selectedSite && collections.length > 0 && (
                    <Card>
                        <CardHeader>
                            <CardTitle>Step 3: Select Collection</CardTitle>
                            <CardDescription>
                                Choose the CMS collection to manage
                            </CardDescription>
                        </CardHeader>
                        <CardPanel className="space-y-2">
                            <Select
                                value={selectedCollection}
                                onValueChange={(value) => handleCollectionSelect(value)}
                            >
                                <SelectTrigger>
                                    <SelectValue>Choose a collection...</SelectValue>
                                </SelectTrigger>
                                <SelectPopup>
                                    {collections.map((collection) => (
                                        <SelectItem key={collection.id} value={collection.id}>
                                            {collection.displayName} (ID: {collection.id})
                                        </SelectItem>
                                    ))}
                                </SelectPopup>
                            </Select>
                        </CardPanel>
                    </Card>
                )}

                {/* Step 4: Items Table */}
                {selectedCollection && items.length > 0 && (
                    <>
                        {/* Toolbar */}
                        <Card>
                            <CardPanel className="p-4">
                                <div className="flex flex-wrap gap-4 items-center justify-between">
                                    <div className="flex gap-2 items-center">
                                        <Input
                                            placeholder="Search items..."
                                            value={searchTerm}
                                            onChange={(e) => setSearchTerm(e.target.value)}
                                            className="w-64"
                                        />
                                        {selectedItems.size > 0 && (
                                            <span className="text-sm text-muted-foreground">
                                                {selectedItems.size} selected
                                            </span>
                                        )}
                                    </div>
                                    <div className="flex gap-2">
                                        <Button
                                            variant="default"
                                            onClick={generateImages}
                                            disabled={selectedItems.size === 0 || isGenerating || !openaiValid}
                                        >
                                            Generate Images ({selectedItems.size})
                                        </Button>
                                        <Button
                                            variant="destructive"
                                            onClick={bulkDelete}
                                            disabled={selectedItems.size === 0}
                                        >
                                            Delete ({selectedItems.size})
                                        </Button>
                                    </div>
                                </div>
                            </CardPanel>
                        </Card>

                        {/* Items Table */}
                        <Card>
                            <CardHeader>
                                <CardTitle>CMS Items: {selectedCollectionData?.displayName}</CardTitle>
                                <CardDescription>
                                    {filteredItems.length} items • Click cell to edit • Select rows for bulk operations
                                </CardDescription>
                            </CardHeader>
                            <CardPanel>
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead className="w-12">
                                                <Checkbox
                                                    checked={selectedItems.size === filteredItems.length && filteredItems.length > 0}
                                                    onCheckedChange={toggleSelectAll}
                                                />
                                            </TableHead>
                                            {fieldNames.slice(0, 8).map((field) => (
                                                <TableHead
                                                    key={field}
                                                    className="cursor-pointer hover:bg-muted/50"
                                                    onClick={() => toggleSort(field)}
                                                >
                                                    <div className="flex items-center gap-1">
                                                        {field}
                                                        {sortColumn === field && (
                                                            <span className="text-xs">{sortDirection === 'asc' ? '↑' : '↓'}</span>
                                                        )}
                                                    </div>
                                                </TableHead>
                                            ))}
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {filteredItems.map((item) => (
                                            <TableRow
                                                key={item.id}
                                                data-state={selectedItems.has(item.id) ? 'selected' : undefined}
                                            >
                                                <TableCell>
                                                    <Checkbox
                                                        checked={selectedItems.has(item.id)}
                                                        onCheckedChange={() => toggleItemSelection(item.id)}
                                                    />
                                                </TableCell>
                                                {fieldNames.slice(0, 8).map((field) => (
                                                    <TableCell
                                                        key={field}
                                                        className="cursor-pointer hover:bg-muted/50"
                                                        onClick={() => startEditing(item.id, field, item.fieldData[field])}
                                                    >
                                                        {editingCell?.itemId === item.id && editingCell?.field === field ? (
                                                            <div className="flex gap-1">
                                                                <Input
                                                                    value={editValue}
                                                                    onChange={(e) => setEditValue(e.target.value)}
                                                                    onKeyDown={(e) => {
                                                                        if (e.key === 'Enter') saveEdit();
                                                                        if (e.key === 'Escape') cancelEdit();
                                                                    }}
                                                                    autoFocus
                                                                    className="h-8 text-sm"
                                                                />
                                                                <Button size="sm" onClick={saveEdit} className="h-8 px-2">
                                                                    ✓
                                                                </Button>
                                                                <Button size="sm" variant="ghost" onClick={cancelEdit} className="h-8 px-2">
                                                                    ✕
                                                                </Button>
                                                            </div>
                                                        ) : (
                                                            <div className="truncate max-w-xs">
                                                                {String(item.fieldData[field] || '')}
                                                            </div>
                                                        )}
                                                    </TableCell>
                                                ))}
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </CardPanel>
                        </Card>
                    </>
                )}

                {/* Progress */}
                {(isGenerating || progress > 0) && (
                    <Card>
                        <CardHeader>
                            <CardTitle>Generation Progress</CardTitle>
                        </CardHeader>
                        <CardPanel className="space-y-4">
                            {total > 0 && (
                                <Progress value={(progress / total) * 100} />
                            )}
                            {currentItem && (
                                <p className="text-sm font-medium">
                                    Current: {currentItem}
                                </p>
                            )}
                            {statusMessage && (
                                <p className="text-sm text-muted-foreground">{statusMessage}</p>
                            )}
                        </CardPanel>
                    </Card>
                )}

                {/* Error Alert */}
                {error && (
                    <Alert variant="error">
                        <AlertTitle>Error</AlertTitle>
                        <AlertDescription>{error}</AlertDescription>
                    </Alert>
                )}

                {/* Success Alert */}
                {!isGenerating && progress > 0 && progress === total && !error && (
                    <Alert variant="success">
                        <AlertTitle>Success!</AlertTitle>
                        <AlertDescription>
                            Successfully generated images for {total} items. Check your Webflow CMS!
                        </AlertDescription>
                    </Alert>
                )}
            </div>
        </main>
    );
}
