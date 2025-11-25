import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { encrypt, decrypt } from '@/lib/crypto'

/**
 * GET - Retrieve user's API keys
 * Returns whether the user has keys saved (but not the actual keys for security)
 */
export async function GET(request: NextRequest) {
    try {
        const supabase = await createClient()
        
        // Get the authenticated user
        const { data: { user }, error: authError } = await supabase.auth.getUser()
        
        if (authError || !user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        // Check if user has API keys stored
        const { data: keysData, error: keysError } = await supabase
            .from('user_api_keys')
            .select('keys_validated, last_validated_at')
            .eq('user_id', user.id)
            .single()

        if (keysError) {
            // No keys found
            if (keysError.code === 'PGRST116') {
                return NextResponse.json({ hasKeys: false })
            }
            console.error('Error fetching user keys:', keysError)
            return NextResponse.json({ error: 'Failed to fetch keys' }, { status: 500 })
        }

        return NextResponse.json({
            hasKeys: true,
            keysValidated: keysData.keys_validated,
            lastValidatedAt: keysData.last_validated_at
        })
    } catch (error) {
        console.error('Error in GET /api/user/keys:', error)
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
}

/**
 * POST - Save or update user's API keys
 * Encrypts the keys before storing in the database
 */
export async function POST(request: NextRequest) {
    try {
        const supabase = await createClient()
        
        // Get the authenticated user
        const { data: { user }, error: authError } = await supabase.auth.getUser()
        
        if (authError || !user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        // Get keys from request body
        const { webflowApiKey, openaiApiKey } = await request.json()

        if (!webflowApiKey || !openaiApiKey) {
            return NextResponse.json({ 
                error: 'Both Webflow and OpenAI API keys are required' 
            }, { status: 400 })
        }

        // Encrypt the API keys
        const encryptedWebflowKey = encrypt(webflowApiKey)
        const encryptedOpenaiKey = encrypt(openaiApiKey)

        // Upsert the keys into the database
        const { error: upsertError } = await supabase
            .from('user_api_keys')
            .upsert({
                user_id: user.id,
                webflow_api_key: encryptedWebflowKey,
                openai_api_key: encryptedOpenaiKey,
                keys_validated: false, // Will be validated separately
                updated_at: new Date().toISOString()
            }, {
                onConflict: 'user_id'
            })

        if (upsertError) {
            console.error('Error upserting user keys:', upsertError)
            return NextResponse.json({ error: 'Failed to save keys' }, { status: 500 })
        }

        return NextResponse.json({ 
            success: true,
            message: 'API keys saved successfully'
        })
    } catch (error) {
        console.error('Error in POST /api/user/keys:', error)
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
}

/**
 * PUT - Validate user's API keys
 * Validates that the keys work with their respective APIs
 */
export async function PUT(request: NextRequest) {
    try {
        const supabase = await createClient()
        
        // Get the authenticated user
        const { data: { user }, error: authError } = await supabase.auth.getUser()
        
        if (authError || !user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        // Get the encrypted keys from the database
        const { data: keysData, error: keysError } = await supabase
            .from('user_api_keys')
            .select('webflow_api_key, openai_api_key')
            .eq('user_id', user.id)
            .single()

        if (keysError || !keysData) {
            return NextResponse.json({ error: 'No API keys found' }, { status: 404 })
        }

        // Decrypt the keys
        const webflowApiKey = decrypt(keysData.webflow_api_key)
        const openaiApiKey = decrypt(keysData.openai_api_key)

        // Validate Webflow API key
        const webflowValidation = await fetch('https://api.webflow.com/v2/sites', {
            headers: {
                'Authorization': `Bearer ${webflowApiKey}`,
                'accept-version': '1.0.0'
            }
        })

        if (!webflowValidation.ok) {
            return NextResponse.json({ 
                error: 'Invalid Webflow API key',
                validationResults: {
                    webflow: false,
                    openai: null
                }
            }, { status: 400 })
        }

        // Validate OpenAI API key
        const openaiValidation = await fetch('https://api.openai.com/v1/models', {
            headers: {
                'Authorization': `Bearer ${openaiApiKey}`
            }
        })

        if (!openaiValidation.ok) {
            return NextResponse.json({ 
                error: 'Invalid OpenAI API key',
                validationResults: {
                    webflow: true,
                    openai: false
                }
            }, { status: 400 })
        }

        // Update validation status
        const { error: updateError } = await supabase
            .from('user_api_keys')
            .update({
                keys_validated: true,
                last_validated_at: new Date().toISOString()
            })
            .eq('user_id', user.id)

        if (updateError) {
            console.error('Error updating validation status:', updateError)
        }

        return NextResponse.json({ 
            success: true,
            message: 'API keys validated successfully',
            validationResults: {
                webflow: true,
                openai: true
            }
        })
    } catch (error) {
        console.error('Error in PUT /api/user/keys:', error)
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
}

/**
 * DELETE - Remove user's API keys
 */
export async function DELETE(request: NextRequest) {
    try {
        const supabase = await createClient()
        
        // Get the authenticated user
        const { data: { user }, error: authError } = await supabase.auth.getUser()
        
        if (authError || !user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        // Delete the user's keys
        const { error: deleteError } = await supabase
            .from('user_api_keys')
            .delete()
            .eq('user_id', user.id)

        if (deleteError) {
            console.error('Error deleting user keys:', deleteError)
            return NextResponse.json({ error: 'Failed to delete keys' }, { status: 500 })
        }

        return NextResponse.json({ 
            success: true,
            message: 'API keys deleted successfully'
        })
    } catch (error) {
        console.error('Error in DELETE /api/user/keys:', error)
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
}


