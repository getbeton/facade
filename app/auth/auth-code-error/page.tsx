import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert'

export default function AuthCodeErrorPage() {
    return (
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background to-secondary p-4">
            <Card className="w-full max-w-md">
                <CardHeader>
                    <CardTitle>Authentication Error</CardTitle>
                    <CardDescription>
                        There was a problem completing your sign-in
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <Alert variant="destructive">
                        <AlertTitle>Error</AlertTitle>
                        <AlertDescription>
                            The authentication code was invalid or has expired. This can happen if:
                            <ul className="list-disc list-inside mt-2">
                                <li>The link was already used</li>
                                <li>The link has expired</li>
                                <li>There was a problem with the authentication provider</li>
                            </ul>
                        </AlertDescription>
                    </Alert>

                    <div className="space-y-2">
                        <Link href="/auth/login">
                            <Button className="w-full">Try Again</Button>
                        </Link>
                        <Link href="/">
                            <Button variant="outline" className="w-full">Go Home</Button>
                        </Link>
                    </div>
                </CardContent>
            </Card>
        </div>
    )
}
