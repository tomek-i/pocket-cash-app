/**
 * Build a GitHub "new issue" URL pre-filled for an error report. Used by the
 * error boundaries so a user can report a crash in one click, with the on-screen
 * "Ref" (the server error digest) already filled in — the digest maps to a full
 * stack in the desktop log file (pocket-cash.log), which we ask them to attach.
 *
 * Opened via window.open; in the desktop shell the window-open handler routes
 * external URLs to the real browser (see apps/desktop windows/app-window.ts).
 */
const ISSUES_NEW_URL = 'https://github.com/tomek-i/pocket-cash-app/issues/new'

export function buildIssueUrl(digest?: string): string {
  const title = digest ? `App error (Ref ${digest})` : 'App error'
  const body = [
    '### What happened',
    '<!-- What were you doing when the error appeared? -->',
    '',
    '### Details',
    `- Error reference (Ref): ${digest ?? '(none shown)'}`,
    '- App version: <!-- see Settings -->',
    '',
    '### Logs',
    'Please attach the log file: click **Open logs** on the error screen and upload',
    '`pocket-cash.log` here (drag it into this box).',
  ].join('\n')
  const params = new URLSearchParams({ title, body, labels: 'bug' })
  return `${ISSUES_NEW_URL}?${params.toString()}`
}
