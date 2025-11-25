import { redirect } from 'next/navigation'

export default function RootPage() {
    // Redirect to dashboard since landing page is handled by Webflow
    redirect('/dashboard')
}
