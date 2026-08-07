import LegalPage, { Section, P, List } from '@/components/marketing/LegalPage'

export const metadata = {
  title: 'Terms of Service — Relay',
  description: 'The rules for using Relay.',
}

export default function TermsPage() {
  return (
    <LegalPage title="Terms of Service" updated="7 August 2026">
      <Section heading="Using Relay">
        <P>
          By creating an account you agree to these terms. You need to be old
          enough to consent to an online service where you are — 13 at minimum,
          and older where local law requires it.
        </P>
        <P>
          You&apos;re responsible for what happens on your account, including
          keeping your password to yourself.
        </P>
      </Section>

      <Section heading="What you send">
        <P>
          You keep ownership of everything you send. You grant Relay only the
          permission needed to run the service: to store your messages and deliver
          them to the people you send them to.
        </P>
        <P>Don&apos;t use Relay to:</P>
        <List items={[
          'Harass, threaten, or abuse anyone',
          'Send illegal content, or content you have no right to share',
          'Impersonate someone else',
          'Send bulk unsolicited messages',
          'Attack, overload or attempt to break into the service',
        ]} />
        <P>
          Accounts doing these things may be suspended or removed without notice.
        </P>
      </Section>

      <Section heading="Usernames">
        <P>
          Usernames are first come, first served, and can be changed once every 30
          days. Usernames that impersonate someone, or that exist only to be sold
          or held, may be reclaimed.
        </P>
      </Section>

      <Section heading="Availability">
        <P>
          Relay is provided as-is, with no guarantee of uptime. It may change,
          break, or become unavailable. Don&apos;t rely on it as your only copy of
          anything important, and don&apos;t use it where a failed message would be
          dangerous or costly.
        </P>
      </Section>

      <Section heading="Ending things">
        <P>
          You can delete your account at any time from Settings. We may suspend or
          terminate accounts that break these terms.
        </P>
      </Section>

      <Section heading="Liability">
        <P>
          To the extent the law allows, Relay and its operator are not liable for
          indirect or consequential loss arising from your use of the service.
          Nothing here removes rights you have that can&apos;t legally be waived.
        </P>
      </Section>

      <Section heading="Changes">
        <P>
          These terms may be updated. Continuing to use Relay after a change means
          you accept the updated version.
        </P>
      </Section>
    </LegalPage>
  )
}
