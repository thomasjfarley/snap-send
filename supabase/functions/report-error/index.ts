// Edge Function: report-error
// Centralised error reporter — called from other edge functions and the client
// when a significant error occurs. Does two things:
//   1. Creates a GitHub Issue (or comments on an existing open one with the
//      same title to avoid duplicates) so errors are tracked and searchable.
//   2. Sends an alert email to support@snapsend.live via Resend.
//
// Request body:
//   source    — which function/screen produced the error (e.g. "submit-postcard")
//   title     — short, stable description used for deduplication (e.g. "Lob 502")
//   severity  — "warning" | "error" | "critical"
//   details   — freeform string or JSON with context (user, PI id, stack trace…)
//   userEmail — (optional) affected user's email
import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';

const RESEND_API_KEY  = Deno.env.get('RESEND_API_KEY')!;
const GITHUB_TOKEN    = Deno.env.get('GITHUB_TOKEN')!;
const GITHUB_REPO     = 'thomasjfarley/snap-send';
const SUPPORT_EMAIL   = 'support@snapsend.live';
const ALERT_FROM      = 'Snap Send Alerts <alerts@snapsend.live>';
const GITHUB_LABEL    = 'automated-error';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

// ── GitHub helpers ─────────────────────────────────────────────────────────────

const GH_HEADERS = {
  Authorization: `Bearer ${GITHUB_TOKEN}`,
  Accept: 'application/vnd.github+json',
  'Content-Type': 'application/json',
  'X-GitHub-Api-Version': '2022-11-28',
};

async function findOpenIssue(issueTitle: string): Promise<{ number: number; html_url: string } | null> {
  // Use the issues list API (not the search API) to avoid the 30-60 second
  // indexing delay that causes duplicates when the same error fires in quick
  // succession. The list API always reflects live data.
  let page = 1;
  while (page <= 3) { // up to 150 issues
    const res = await fetch(
      `https://api.github.com/repos/${GITHUB_REPO}/issues?labels=${GITHUB_LABEL}&state=open&per_page=50&page=${page}`,
      { headers: GH_HEADERS },
    );
    if (!res.ok) {
      console.error('[report-error] GitHub issues list failed:', res.status, await res.text());
      return null;
    }
    const issues: Array<{ number: number; html_url: string; title: string }> = await res.json();
    if (!Array.isArray(issues) || issues.length === 0) break;
    const match = issues.find(i => i.title === issueTitle);
    if (match) return { number: match.number, html_url: match.html_url };
    if (issues.length < 50) break;
    page++;
  }
  return null;
}

async function createIssue(opts: {
  title: string;
  body: string;
  severity: string;
}): Promise<{ number: number; html_url: string } | null> {
  const labels = [GITHUB_LABEL, 'bug', opts.severity];
  const res = await fetch(`https://api.github.com/repos/${GITHUB_REPO}/issues`, {
    method: 'POST',
    headers: GH_HEADERS,
    body: JSON.stringify({ title: opts.title, body: opts.body, labels }),
  });
  if (!res.ok) {
    console.error('[report-error] GitHub create issue failed:', res.status, await res.text());
    return null;
  }
  return res.json();
}

async function addComment(issueNumber: number, body: string): Promise<void> {
  const res = await fetch(
    `https://api.github.com/repos/${GITHUB_REPO}/issues/${issueNumber}/comments`,
    { method: 'POST', headers: GH_HEADERS, body: JSON.stringify({ body }) },
  );
  if (!res.ok) {
    console.error('[report-error] GitHub add comment failed:', res.status, await res.text());
  }
}

// ── Resend helper ──────────────────────────────────────────────────────────────

async function sendEmail(subject: string, text: string): Promise<void> {
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ from: ALERT_FROM, to: [SUPPORT_EMAIL], subject, text }),
  });
  if (!res.ok) {
    console.error('[report-error] Resend failed:', res.status, await res.json().catch(() => ({})));
  }
}

// ── Main ───────────────────────────────────────────────────────────────────────

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const {
      source = 'unknown',
      title,
      severity = 'error',
      details = '',
      userEmail = '',
    } = await req.json();

    if (!title) return jsonResponse({ error: 'Missing title' }, 400);

    const issueTitle = `[${severity.toUpperCase()}] ${source}: ${title}`;
    const timestamp  = new Date().toISOString();
    const detailStr  = typeof details === 'string' ? details : JSON.stringify(details, null, 2);

    const issueBody = [
      `**Source:** \`${source}\``,
      `**Severity:** ${severity}`,
      `**First seen:** ${timestamp}`,
      userEmail ? `**User:** ${userEmail}` : '',
      '',
      '### Details',
      '```',
      detailStr,
      '```',
      '',
      '_This issue was created automatically by the Snap Send error reporter._',
    ].filter(s => s !== null).join('\n');

    const commentBody = [
      `### Recurrence — ${timestamp}`,
      userEmail ? `**User:** ${userEmail}` : '',
      '',
      '```',
      detailStr,
      '```',
    ].filter(s => s !== null).join('\n');

    // 1. GitHub — create or comment
    let issueUrl = '';
    let isNew = false;
    try {
      const existing = await findOpenIssue(issueTitle);
      if (existing) {
        await addComment(existing.number, commentBody);
        issueUrl = existing.html_url;
      } else {
        const created = await createIssue({ title: issueTitle, body: issueBody, severity });
        if (created) {
          issueUrl = created.html_url;
          isNew = true;
        }
      }
    } catch (ghErr) {
      console.error('[report-error] GitHub step threw:', ghErr);
    }

    // 2. Email
    const sevEmoji = severity === 'critical' ? '🚨' : severity === 'warning' ? '⚠️' : '🔴';
    const emailSubject = `${sevEmoji} Snap Send error: ${source} — ${title}`;
    const emailBody = [
      `Source:    ${source}`,
      `Severity:  ${severity}`,
      `Time:      ${timestamp}`,
      userEmail ? `User:      ${userEmail}` : '',
      '',
      'Details:',
      detailStr,
      '',
      issueUrl
        ? `GitHub Issue (${isNew ? 'NEW' : 'existing'}): ${issueUrl}`
        : 'GitHub Issue: could not create (check Supabase logs)',
    ].filter(s => s !== null).join('\n');

    await sendEmail(emailSubject, emailBody);

    return jsonResponse({ success: true, issueUrl, isNew });
  } catch (err) {
    console.error('[report-error] unhandled error:', err);
    return jsonResponse({ error: 'Internal error' }, 500);
  }
});
