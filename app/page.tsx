import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'

export default function LandingPage() {
    return (
        <main className="min-h-screen bg-gradient-to-br from-background to-secondary">
            <div className="container mx-auto px-4 py-16">
                <div className="max-w-4xl mx-auto text-center space-y-8">
                    <h1 className="text-5xl font-bold">Webflow CMS Image Generator</h1>
                    <p className="text-xl text-muted-foreground">
                        Generate beautiful ukiyo-e style OG images for your Webflow CMS collections using AI
                    </p>

                    <div className="flex gap-4 justify-center">
                        <Link href="/auth/signup">
                            <Button size="lg">Get Started</Button>
                        </Link>
                        <Link href="/auth/login">
                            <Button size="lg" variant="outline">
                                Sign In
                            </Button>
                        </Link>
                    </div>

                    <div className="grid md:grid-cols-2 gap-6 mt-12">
                        <Card>
                            <CardHeader>
                                <CardTitle>Free Tier</CardTitle>
                                <CardDescription>
                                    Bring your own Webflow and OpenAI API keys for unlimited generations
                                </CardDescription>
                            </CardHeader>
                        </Card>

                        <Card>
                            <CardHeader>
                                <CardTitle>Pay As You Go</CardTitle>
                                <CardDescription>
                                    $0.89 per image using our platform keys. No API setup needed!
                                </CardDescription>
                            </CardHeader>
                        </Card>
                    </div>
                </div>
            </div>
        </main>
    )
}
