import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Get auth header to verify user
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Not authenticated' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;

    // Get the user from the auth token
    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: userError } = await userClient.auth.getUser();

    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: 'Invalid user' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Use service role client for DB operations
    const adminClient = createClient(supabaseUrl, supabaseServiceKey);

    // Check if welcome email already sent
    const { data: profile } = await adminClient
      .from('user_profiles')
      .select('welcome_email_sent')
      .eq('id', user.id)
      .single();

    if (profile?.welcome_email_sent) {
      return new Response(
        JSON.stringify({ success: true, alreadySent: true }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Upsert profile to mark welcome email as sent
    await adminClient.from('user_profiles').upsert({
      id: user.id,
      welcome_email_sent: true,
      first_login_at: new Date().toISOString(),
    });

    // Send welcome email via Resend
    const resendApiKey = Deno.env.get('RESEND_API_KEY');
    if (!resendApiKey) {
      console.warn('RESEND_API_KEY not configured, skipping email send');
      return new Response(
        JSON.stringify({ success: true, emailSkipped: true }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const userEmail = user.email;
    if (!userEmail) {
      return new Response(
        JSON.stringify({ success: true, noEmail: true }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const emailHtml = `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 40px 20px;">
        <h1 style="color: #1a1a1a; font-size: 24px; margin-bottom: 16px;">Welcome to BreakLingo! 🎉</h1>
        <p style="color: #4a4a4a; font-size: 16px; line-height: 1.6;">
          Thank you for signing up! We're excited to see you starting a new journey to learning languages with our app.
        </p>
        <p style="color: #4a4a4a; font-size: 16px; line-height: 1.6;">
          With BreakLingo, you can learn languages from YouTube videos — discover vocabulary, practice grammar, and even have voice conversations with AI in your target language.
        </p>
        <p style="color: #4a4a4a; font-size: 16px; line-height: 1.6;">
          If you have any questions, feedback, or anything you'd like to share about this app, please just reply to this email. I'd love to hear from you!
        </p>
        <p style="color: #4a4a4a; font-size: 16px; line-height: 1.6;">
          I'm looking forward to your feedback. 🙏
        </p>
        <p style="color: #4a4a4a; font-size: 16px; line-height: 1.6; margin-top: 24px;">
          Happy learning!<br/>
          <strong>The BreakLingo Team</strong>
        </p>
      </div>
    `;

    const emailResponse = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${resendApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'BreakLingo <onboarding@resend.dev>',
        to: [userEmail],
        subject: 'Welcome to BreakLingo! 🎉 Your language learning journey starts now',
        html: emailHtml,
      }),
    });

    if (!emailResponse.ok) {
      const errText = await emailResponse.text();
      console.error('Resend API error:', errText);
      // Don't fail the request — email is best-effort
    } else {
      console.log('Welcome email sent to:', userEmail);
    }

    return new Response(
      JSON.stringify({ success: true }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in send-welcome-email:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
