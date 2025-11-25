import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

export default function NewCollectionPage() {
    return (
        <div className="container mx-auto py-10 max-w-2xl">
            <Card>
                <CardHeader>
                    <CardTitle>Link New Collection</CardTitle>
                    <CardDescription>
                        Connect your Webflow site and OpenAI to start generating images.
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="space-y-2">
                        <Label htmlFor="webflow-key">Webflow API Key</Label>
                        <Input id="webflow-key" placeholder="Enter your Webflow API key" />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="openai-key">OpenAI API Key</Label>
                        <Input id="openai-key" placeholder="Enter your OpenAI API key" />
                    </div>
                    <Button className="w-full">Connect</Button>
                </CardContent>
            </Card>
        </div>
    )
}
