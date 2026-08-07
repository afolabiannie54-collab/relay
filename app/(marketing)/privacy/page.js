import LegalPage, { Section, P, List } from '@/components/marketing/LegalPage'

export const metadata = {
  title: 'Privacy Policy — Relay',
  description: 'What Relay collects, why, and who it is shared with.',
}

// Written against what the app actually does rather than from a template:
// the sub-processor list, the transcription disclosure and the
// not-end-to-end-encrypted statement all describe real behaviour in this
// codebase. A generic policy would have quietly omitted the OpenAI step.
export default function PrivacyPage() {
  return (
    <LegalPage title="Privacy Policy" updated="7 August 2026">
      <Section heading="The short version">
        <P>
          Relay stores the account details you give it and the messages you send,
          so it can deliver them. It doesn&apos;t sell your data, show you ads, or
          upload your phone&apos;s contacts. Messages are <strong>not</strong>{' '}
          end-to-end encrypted — see &ldquo;What we can see&rdquo; below.
        </P>
      </Section>

      <Section heading="What we collect">
        <P>Account information:</P>
        <List items={[
          'Your email address, or the Google account you sign in with',
          'Your username, display name, and — if you add them — an avatar, bio and social links',
        ]} />
        <P>Things you send:</P>
        <List items={[
          'Messages, images, voice notes and files you send or receive',
          'Reactions, pinned messages, and messages you star',
        ]} />
        <P>Activity needed to make messaging work:</P>
        <List items={[
          'When you were last online, so others can see “last seen” if you allow it',
          'Read and delivery timestamps, which power the ticks on your messages',
          'Who you have blocked, and pending message requests',
          'Browser and device information for signed-in sessions, so you can review and sign them out',
          'Push notification subscriptions for devices where you enable notifications',
        ]} />
      </Section>

      <Section heading="Voice note transcription">
        <P>
          When you send a voice note, the audio is sent to <strong>OpenAI</strong>{' '}
          to be transcribed into text so the person receiving it can read it. This
          is on by default and controlled by you, the sender, under{' '}
          <strong>Settings → Privacy → Transcribe my voice notes</strong>. Turn it
          off and your voice notes are never sent anywhere for transcription.
        </P>
      </Section>

      <Section heading="What we can see">
        <P>
          Relay is not end-to-end encrypted. Messages are encrypted in transit and
          stored encrypted at rest by our hosting providers, but they are stored in
          a form the service can read. Treat Relay as private from other users, not
          as private from the people who operate it. If you need guaranteed
          secrecy from operators, use an end-to-end encrypted messenger instead.
        </P>
      </Section>

      <Section heading="Who else processes your data">
        <List items={[
          'Supabase — database, authentication and file storage',
          'Vercel — application hosting',
          'OpenAI — voice note transcription only, and only when you have it enabled',
          'Google — only if you choose to sign in with Google',
        ]} />
        <P>Relay does not sell your data or share it with advertisers.</P>
      </Section>

      <Section heading="Your controls">
        <List items={[
          'Choose whether you appear in search, show your online status, or show last seen',
          'Turn read receipts off — which also stops you seeing other people\'s',
          'Turn voice note transcription off',
          'Block anyone, and require strangers to send a request before messaging you',
          'Change your email and password, and sign out other devices, under Settings → Security',
        ]} />
      </Section>

      <Section heading="Deleting your account">
        <P>
          You can delete your account from <strong>Settings → Delete account</strong>.
          This removes your profile and signs you out everywhere. Messages you sent
          into conversations with other people are detached from your account rather
          than removed from their copy of the conversation — the same way deleting
          your account elsewhere doesn&apos;t reach into other people&apos;s inboxes.
        </P>
      </Section>

      <Section heading="Contact">
        <P>
          Relay is an independent project. For questions about this policy or your
          data, contact the operator of this instance.
        </P>
      </Section>
    </LegalPage>
  )
}
