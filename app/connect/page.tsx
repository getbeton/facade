'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Loader2, ArrowRight, Check, X } from 'lucide-react';
import {
    InputGroup,
    InputGroupInput,
    InputGroupAddon,
} from '@/components/ui/input-group';
import {
    Field,
    FieldLabel,
    FieldError,
    FieldDescription,
} from '@/components/ui/field';
import { Switch } from '@/components/ui/switch';
import { WebflowIcon, OpenAIIcon } from '@/components/icons';
import { MainHeader } from '@/components/main-header';

type ValidationStatus = 'idle' | 'validating' | 'valid' | 'invalid';

export default function ConnectPage() {
    const router = useRouter();
    const [isConnecting, setIsConnecting] = useState(false);
    const [globalError, setGlobalError] = useState<string | null>(null);

    // Webflow State
    const [webflowKey, setWebflowKey] = useState('');
    const [webflowStatus, setWebflowStatus] = useState<ValidationStatus>('idle');

    // OpenAI State
    const [isManagedMode, setIsManagedMode] = useState(true);
    const [openaiKey, setOpenaiKey] = useState('');
    const [openaiStatus, setOpenaiStatus] = useState<ValidationStatus>('idle');

    const validateWebflow = async () => {
        if (!webflowKey) return;
        setWebflowStatus('validating');
        try {
            const res = await fetch('/api/validate-webflow', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ apiKey: webflowKey }),
            });
            const data = await res.json();
            setWebflowStatus(data.valid ? 'valid' : 'invalid');
        } catch (error) {
            console.error(error);
            setWebflowStatus('invalid');
        }
    };

    const validateOpenAI = async () => {
        if (!openaiKey) return;
        setOpenaiStatus('validating');
        try {
            const res = await fetch('/api/validate-openai', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ apiKey: openaiKey }),
            });
            const data = await res.json();
            setOpenaiStatus(data.valid ? 'valid' : 'invalid');
        } catch (error) {
            console.error(error);
            setOpenaiStatus('invalid');
        }
    };

    const handleConnect = async () => {
        setIsConnecting(true);
        setGlobalError(null);

        try {
            const res = await fetch('/api/connect', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    webflowApiKey: webflowKey, 
                    openaiApiKey: isManagedMode ? undefined : openaiKey
                }),
            });

            const data = await res.json();

            if (!res.ok) {
                throw new Error(data.error || 'Failed to connect');
            }

            router.push('/dashboard');
        } catch (err: any) {
            setGlobalError(err.message);
        } finally {
            setIsConnecting(false);
        }
    };

    const handleDevMode = () => {
        router.push('/dashboard?mode=dev');
    };

    const isWebflowValid = webflowStatus === 'valid';
    const isOpenAIValid = isManagedMode || openaiStatus === 'valid';
    const canProceed = isWebflowValid && isOpenAIValid;

    return (
        <div className="min-h-screen bg-muted/40 flex flex-col">
            <MainHeader user={{ email: 'user@example.com' } as any} />
            <div className="flex-1 flex flex-col items-center justify-center p-4 space-y-6">
                
                <Card className="w-full max-w-md relative overflow-hidden border-2">
                    <CardHeader>
                        <CardTitle>Connect Your Stack</CardTitle>
                        <CardDescription>
                            Enter your API keys to unlock one-click magic.
                        </CardDescription>
                    </CardHeader>
                    
                    <CardContent className="space-y-8">
                        {globalError && (
                             <div className="text-sm text-destructive font-medium bg-destructive/10 p-3 rounded-md">
                                {globalError}
                            </div>
                        )}

                        {/* Webflow Section */}
                        <Field>
                            <FieldLabel className="flex justify-between w-full">
                                <span>Webflow API Token</span>
                                {webflowStatus === 'valid' && <Badge variant="default" className="bg-green-600 hover:bg-green-700"><Check className="w-3 h-3 mr-1" /> Valid</Badge>}
                                {webflowStatus === 'invalid' && <Badge variant="destructive"><X className="w-3 h-3 mr-1" /> Invalid</Badge>}
                            </FieldLabel>
                            <InputGroup>
                                <InputGroupAddon>
                                    <WebflowIcon className="w-5 h-5 text-muted-foreground" />
                                </InputGroupAddon>
                                <InputGroupInput 
                                    placeholder="wf_..." 
                                    type="password" 
                                    value={webflowKey}
                                    onChange={(e) => {
                                        setWebflowKey(e.target.value);
                                        if (webflowStatus !== 'idle') setWebflowStatus('idle');
                                    }}
                                />
                                <InputGroupAddon align="inline-end">
                                    <Button 
                                        variant="ghost" 
                                        size="icon-xs" 
                                        onClick={validateWebflow}
                                        disabled={!webflowKey || webflowStatus === 'validating'}
                                        aria-label="Validate Webflow Token"
                                    >
                                        {webflowStatus === 'validating' ? (
                                            <Loader2 className="w-4 h-4 animate-spin" />
                                        ) : (
                                            <ArrowRight className="w-4 h-4" />
                                        )}
                                    </Button>
                                </InputGroupAddon>
                            </InputGroup>
                            <FieldDescription>Required to scan your sites and upload content.</FieldDescription>
                        </Field>

                        {/* OpenAI Section */}
                        <div className="space-y-4">
                             <div className="flex items-center justify-between">
                                <FieldLabel className="flex items-center gap-2">
                                    <span>OpenAI API Key</span>
                                </FieldLabel>
                                <div className="flex items-center gap-2">
                                    <span className="text-xs text-muted-foreground">
                                        {isManagedMode ? 'Managed' : 'Use my own key'}
                                    </span>
                                    <Switch 
                                        checked={!isManagedMode}
                                        onCheckedChange={(checked) => {
                                            setIsManagedMode(!checked);
                                            setOpenaiStatus('idle');
                                        }}
                                    />
                                </div>
                            </div>

                            {isManagedMode ? (
                                <div className="rounded-lg border bg-muted/50 p-3 flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <div className="p-1">
                                            <OpenAIIcon className="w-5 h-5 text-muted-foreground" />
                                        </div>
                                        <div className="flex flex-col">
                                            <div className="flex items-center gap-2">
                                                <span className="text-sm font-medium">Beton Managed</span>
                                                <Badge variant="secondary" className="bg-green-100 text-green-700 hover:bg-green-200 border-green-200">
                                                    Active
                                                </Badge>
                                            </div>
                                            <span className="text-xs text-muted-foreground mt-1 block">$0.01 / text field + $0.05 / image</span>
                                        </div>
                                    </div>
                                </div>
                            ) : (
                                <Field>
                                    <FieldLabel className="flex justify-between w-full">
                                        <span className="sr-only">Your API Key</span>
                                        {openaiStatus === 'valid' && <Badge variant="default" className="bg-green-600 hover:bg-green-700"><Check className="w-3 h-3 mr-1" /> Valid</Badge>}
                                        {openaiStatus === 'invalid' && <Badge variant="destructive"><X className="w-3 h-3 mr-1" /> Invalid</Badge>}
                                    </FieldLabel>
                                    <InputGroup>
                                        <InputGroupAddon>
                                            <OpenAIIcon className="w-5 h-5 text-muted-foreground" />
                                        </InputGroupAddon>
                                        <InputGroupInput 
                                            placeholder="sk-..." 
                                            type="password" 
                                            value={openaiKey}
                                            onChange={(e) => {
                                                setOpenaiKey(e.target.value);
                                                if (openaiStatus !== 'idle') setOpenaiStatus('idle');
                                            }}
                                        />
                                        <InputGroupAddon align="inline-end">
                                            <Button 
                                                variant="ghost" 
                                                size="icon-xs" 
                                                onClick={validateOpenAI}
                                                disabled={!openaiKey || openaiStatus === 'validating'}
                                                aria-label="Validate OpenAI Key"
                                            >
                                                 {openaiStatus === 'validating' ? (
                                                    <Loader2 className="w-4 h-4 animate-spin" />
                                                ) : (
                                                    <ArrowRight className="w-4 h-4" />
                                                )}
                                            </Button>
                                        </InputGroupAddon>
                                    </InputGroup>
                                    <FieldDescription>Using your own key avoids per-field charges.</FieldDescription>
                                </Field>
                            )}
                        </div>

                    </CardContent>
                    <CardFooter className="flex flex-col gap-3">
                        <Button 
                            onClick={handleConnect} 
                            className="w-full" 
                            disabled={isConnecting || !canProceed}
                        >
                            {isConnecting ? (
                                <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    Connecting...
                                </>
                            ) : (
                                'Connect & Scan'
                            )}
                        </Button>
                        
                        <div className="relative w-full text-center my-2">
                            <div className="absolute inset-0 flex items-center">
                                <span className="w-full border-t" />
                            </div>
                            <div className="relative flex justify-center text-xs uppercase">
                                <span className="bg-background px-2 text-muted-foreground">Or</span>
                            </div>
                        </div>

                        <Button 
                            variant="outline" 
                            className="w-full" 
                            onClick={handleDevMode}
                        >
                            Try Demo / Dev Mode
                        </Button>
                    </CardFooter>
                </Card>
            </div>
        </div>
    );
}
