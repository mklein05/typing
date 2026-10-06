import { Link } from 'react-router-dom';
import LegalPage, { Section } from './LegalPage';


export default function TermsOfService() {
  return (
    <LegalPage title="Terms of Service" updated="23 September 2026">
      <Section title="In short">
        <p>
          Use typingSeal fairly, don&rsquo;t abuse it, and understand that it is provided as-is.
          If you need the detail, it is below.
        </p>
      </Section>

      <Section title="Agreement">
        <p>
          By using typingSeal (typingseal.com) you agree to these terms. If you do not agree with
          them, please do not use the service.
        </p>
      </Section>

      <Section title="Your account">
        <p>
          You sign in with Google, and you are responsible for your account, for keeping it secure,
          and for anything done with it.
        </p>
      </Section>

      <Section title="Acceptable use">
        <p>While using typingSeal, please do not:</p>
        <ul className="list-disc pl-5 space-y-1">
          <li>break any law, or use the service to harm others;</li>
          <li>attack, overload, probe, or otherwise disrupt the service or its servers;</li>
          <li>scrape it, or access it with bots or automated tools;</li>
          <li>try to bypass sign-in, plan limits, or other restrictions;</li>
          <li>upload or transmit malware, or content that is unlawful or abusive.</li>
        </ul>
        <p>
          We may suspend or remove an account that breaks these rules, usually without notice.
        </p>
      </Section>

      <Section title="Your content">
        <p>
          Your results are yours. You give us permission to store and process them for the sole
          purpose of running the service — showing your statistics and building your practice.
        </p>
      </Section>

      <Section title="Availability and changes">
        <p>
          We may change, suspend, or discontinue any part of typingSeal at any time. We may also
          update these terms; if we do, the new version applies from the date at the top of this
          page, and continuing to use the service means you accept it.
        </p>
      </Section>

      <Section title="Disclaimer">
        <p>
          typingSeal is provided &ldquo;as is&rdquo; and &ldquo;as available&rdquo;, without
          warranties of any kind. We do not promise that it will always be available, accurate, or
          error-free. To the fullest extent permitted by law, we disclaim all warranties, express
          or implied.
        </p>
      </Section>

      <Section title="Limitation of liability">
        <p>
          To the fullest extent permitted by law, we are not liable for any indirect or
          consequential loss, or for lost data, arising from your use of typingSeal.
        </p>
      </Section>

      <Section title="Privacy">
        <p>
          Our <Link to="/privacy" className="theme-text underline underline-offset-2 hover:text-amber-400 transition-colors">Privacy Policy</Link>{' '}
          explains what we store and why, and forms part of these terms.
        </p>
      </Section>

      <Section title="Contact">
        <p>
          Questions about these terms:{' '}
          <span className="theme-text">ironpin11@gmail.com</span>.
        </p>
      </Section>
    </LegalPage>
  );
}
