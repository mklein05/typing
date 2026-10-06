import LegalPage, { Section } from './LegalPage';

/**
 * Privacy policy — plain-language version.
 *
 * ============================ BEFORE PUBLISHING ============================
 * Replace every [CONTACT EMAIL] with a monitored address (e.g.
 * contact@typingseal.com). It is in caps on purpose so an unreplaced one is
 * obvious on the rendered page.
 *
 * No registered company name is required: a project name plus a working contact
 * satisfies GDPR's requirement that the controller be identifiable, which is the
 * approach MonkeyType takes. Add a legal name only if you incorporate, or if a
 * payment provider asks for one.
 *
 * When payments go live, add one short section naming the payment provider and
 * what it collects. Nothing about billing is stated below because nothing about
 * billing exists yet.
 *
 * This is a template, not legal advice. Have it reviewed before you rely on it.
 * ==========================================================================
 */
export default function PrivacyPolicy() {
  return (
    <LegalPage title="Privacy Policy" updated="23 September 2026">
      <Section title="In short">
        <ul className="list-disc pl-5 space-y-1">
          <li>We store your email and a username so you can sign in and save results.</li>
          <li>We store your test results and your keystrokes so we can show your stats and build practice.</li>
          <li>We don&rsquo;t sell your data, run ads, or track you across other sites.</li>
          <li>Ask us and we&rsquo;ll delete your data.</li>
        </ul>
      </Section>

      <Section title="Who we are">
        <p>
          typingSeal (typingseal.com) — &ldquo;we&rdquo;, &ldquo;us&rdquo;. For any privacy
          question or request, email <span className="theme-text">ironpin11@gmail.com</span>.
        </p>
      </Section>

      <Section title="What we store">
        <p className="theme-text font-bold">Your account</p>
        <p>
          When you sign in with Google we receive your email address, and Google may also pass
          along your name and profile picture. We store your email and the display username you
          choose. We never see your Google password.
        </p>

        <p className="theme-text font-bold">Your results</p>
        <p>
          Each completed test saves your words per minute, accuracy, duration, and the words you
          were shown.
        </p>

        <p className="theme-text font-bold">Your keystrokes</p>
        <p>
          We also save each keystroke: the key you pressed, the key expected, whether it matched,
          and how long you held it. This is the most detailed data we keep — it is what powers the
          per-letter and per-pair statistics, and it is why the dashboard can point at the exact
          letters that slow you down. It is never sold or shared beyond the providers listed below.
        </p>

        <p className="theme-text font-bold">Usage counts</p>
        <p>
          We count how often you use metered features (such as AI passages) so that plan limits
          work.
        </p>

        <p className="theme-text font-bold">Basic technical data</p>
        <p>
          Like most websites, our servers record routine information such as your IP address and
          browser type when you make a request. This is used to keep the site secure and to
          diagnose faults — not to build advertising profiles.
        </p>
      </Section>

      <Section title="Cookies and local storage">
        <p>
          We set no advertising or analytics cookies, and there is no third-party tracking. When
          you sign in, a session token is kept in your browser&rsquo;s local storage so you stay
          signed in between visits. Clearing your browser storage signs you out.
        </p>
      </Section>

      <Section title="Signing in with Google">
        <p>
          Choosing &ldquo;Sign in with Google&rdquo; passes us the profile information described
          above, and we use it only to create and authenticate your account. Our use of
          information received from Google APIs adheres to the{' '}
          <a
            href="https://developers.google.com/terms/api-services-user-data-policy"
            target="_blank"
            rel="noreferrer"
            className="text-slate-400 hover:text-amber-400 transition-colors underline underline-offset-2"
          >
            Google API Services User Data Policy
          </a>
          , including the Limited Use requirements.
        </p>
      </Section>

      <Section title="AI practice (optional)">
        <p>
          AI practice only runs when you press the button. To generate a passage, we send the
          letter pairs it should focus on and the requested length to OpenRouter. No account
          details and no keystroke history are sent.
        </p>
      </Section>

      <Section title="Who we share it with">
        <p>
          We never sell your data. We share it only with the providers that run the site, and only
          as far as needed:
        </p>
        <ul className="list-disc pl-5 space-y-1">
          <li><span className="theme-text">Supabase</span> — sign-in, and private storage of database backups</li>
          <li><span className="theme-text">Railway</span> — hosting and database storage</li>
          <li><span className="theme-text">Cloudflare</span> — content delivery and network protection</li>
          <li><span className="theme-text">Google</span> — sign-in</li>
          <li><span className="theme-text">OpenRouter</span> — generating AI practice passages (see above)</li>
        </ul>
        <p>We may also disclose data where the law requires it.</p>
      </Section>

      <Section title="How long we keep it">
        <p>
          Your account and typing data stay for as long as your account exists, and are deleted
          when you ask us to delete them. We also take a daily database backup and keep the most
          recent 14 days; older backups are removed automatically.
        </p>
      </Section>

      <Section title="Deleting your data and your rights">
        <p>
          To access, correct, export, or delete your data, email{' '}
          <span className="theme-text">ironpin11@gmail.com</span> and we will act within the time the
          law requires. Depending on where you live you may also have the right to object to or
          restrict certain processing. If you are in the EU or UK, you can complain to your local
          data protection authority.
        </p>
      </Section>

      <Section title="Security">
        <p>
          Traffic is encrypted with HTTPS, and your data and its backups are reachable only from
          our own servers. No system is perfectly secure, but we hold no payment details, which
          limits what could be exposed.
        </p>
      </Section>

      <Section title="Children">
        <p>
          typingSeal is not intended for children under 13, and we do not knowingly collect their
          personal information. If you believe a child has given us data, contact us and we will
          delete it.
        </p>
      </Section>

      <Section title="Where your data is processed">
        <p>
          Our providers are located mainly in the United States, so your information may be
          transferred to and processed there.
        </p>
      </Section>

      <Section title="Changes to this policy">
        <p>
          If we make a material change to how we handle your information, we will update the date
          at the top of this page and, where it matters, tell you in the app.
        </p>
      </Section>

      <Section title="Contact">
        <p>
          Questions, requests, or complaints:{' '}
          <span className="theme-text">ironpin11@gmail.com</span>.
        </p>
      </Section>
    </LegalPage>
  );
}
