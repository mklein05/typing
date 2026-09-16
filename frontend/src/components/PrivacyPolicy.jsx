import { useNavigate } from 'react-router-dom';

/**
 * Privacy policy.
 *
 * ============================ BEFORE PUBLISHING ============================
 * Replace every [BRACKETED PLACEHOLDER]. It is deliberately in caps so an
 * unreplaced one is obvious in the rendered page.
 *
 *   [CONTACT EMAIL]    a monitored address, e.g. contact@typingseal.com
 *
 * That is the only one. A legal name is deliberately NOT required: GDPR requires
 * the controller to be identifiable and contactable, which the project name plus
 * a working address satisfies. MonkeyType does exactly this. Add a registered
 * name only if you incorporate, or if your payment provider asks for it.
 *
 * When you start taking payments, this needs a new section naming the payment
 * provider and what they collect. Nothing about billing is stated below because
 * nothing about billing exists yet.
 * ==========================================================================
 */

function Section({ title, children }) {
  return (
    <section className="mt-8">
      <h2 className="font-pixel theme-text text-lg font-bold mb-3">{title}</h2>
      <div className="theme-text-soft text-sm leading-relaxed space-y-3">{children}</div>
    </section>
  );
}

export default function PrivacyPolicy() {
  const navigate = useNavigate();

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="max-w-3xl mx-auto px-6 py-10">
        <h1 className="font-pixel theme-text text-3xl font-bold">Privacy Policy</h1>
        <p className="theme-text-muted text-sm mt-2">Last updated 16 September 2026</p>

        <Section title="Who we are">
          <p>
            typingSeal is a typing practice website available at typingseal.com
            (&ldquo;typingSeal&rdquo;, &ldquo;we&rdquo;, &ldquo;us&rdquo;). This policy explains what we
            collect when you use typingSeal, why we collect it, and what control you have over it.
            We are the data controller responsible for that information, and our contact details
            appear below.
          </p>
          <p>
            For any privacy question or request, contact{' '}
            <span className="theme-text">[CONTACT EMAIL]</span>.
          </p>
        </Section>

        <Section title="What we collect">
          <p className="theme-text font-bold">Account information</p>
          <p>
            When you sign in with Google we receive your email address, your name, and your
            profile picture URL. We never receive your Google password. You also choose a display
            username, which is stored with your account.
          </p>

          <p className="theme-text font-bold">Typing data</p>
          <p>
            When you complete a test we store the result — words per minute, accuracy, duration,
            and the words you were shown. We also store your keystrokes individually: which key
            you pressed, which key was expected, whether it was correct, and the timing of each
            press and release in milliseconds. This per-keystroke detail is what lets us show you
            which letter combinations you struggle with, and it is the most detailed category of
            data we hold.
          </p>

          <p className="theme-text font-bold">Usage data</p>
          <p>
            We record how many times you use certain metered features, so that plan limits can be
            applied.
          </p>

          <p className="theme-text font-bold">Connection data</p>
          <p>
            Our hosting and content delivery providers process technical information such as your
            IP address and browser type in the course of serving the site securely. We do not use
            this to build advertising profiles.
          </p>

          <p>
            We do not collect payment or financial information.
          </p>
        </Section>

        <Section title="How we use it">
          <ul className="list-disc pl-5 space-y-1">
            <li>To provide the service — storing your results, building your dashboard statistics, and generating personalised practice</li>
            <li>To keep you signed in</li>
            <li>To keep the service working and secure, including diagnosing faults, preventing abuse, and maintaining backups</li>
            <li>To apply the limits of your plan</li>
          </ul>
          <p>
            We do not use your data for advertising, and we do not sell it.
          </p>
          <p>
            Where the GDPR applies, we rely on these legal bases: performance of a contract (to
            provide the service you asked for), legitimate interests (to keep the service secure
            and functioning), and consent where we specifically ask for it.
          </p>
        </Section>

        <Section title="Cookies and local storage">
          <p>
            We do not use advertising or analytics cookies, and there is no third-party tracking
            on this site. When you sign in, our authentication provider stores a session token in
            your browser&rsquo;s local storage so that you stay signed in between page loads.
            Clearing your browser storage will sign you out.
          </p>
        </Section>

        <Section title="Google user data">
          <p>
            If you choose &ldquo;Sign in with Google&rdquo;, we receive the profile information
            described above and use it solely to create and authenticate your account. Our use and
            transfer to any other app of information received from Google APIs will adhere to the{' '}
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

        <Section title="Who we share it with">
          <p>
            We do not sell your personal information. We share it only with the service providers
            that help us run typingSeal, and only as far as needed:
          </p>
          <ul className="list-disc pl-5 space-y-1">
            <li><span className="theme-text">Supabase</span> — authentication, and secure storage of database backups</li>
            <li><span className="theme-text">Railway</span> — application hosting and database storage</li>
            <li><span className="theme-text">Cloudflare</span> — content delivery and network protection</li>
            <li><span className="theme-text">Google</span> — sign-in</li>
          </ul>
          <p>
            We may also disclose information if we are legally required to do so.
          </p>
        </Section>

        <Section title="How long we keep it">
          <p>
            Your account and typing data are kept for as long as your account exists. When your
            account is deleted, they are deleted.
          </p>
          <p>
            We also take a daily backup of the database and keep the most recent 14 days. Backups
            are held in private, access-controlled storage and are removed automatically once they
            age out.
          </p>
        </Section>

        <Section title="Security">
          <p>
            Data is transmitted over HTTPS. The database and its backups are reachable only from
            our own servers, and backup storage is not publicly accessible. No system is perfectly
            secure, and we cannot guarantee absolute security — but we do not hold payment details,
            which limits what could be exposed.
          </p>
        </Section>

        <Section title="Your rights">
          <p>
            Depending on where you live, you may have the right to access, correct, export, or
            delete your personal information, and to object to or restrict certain processing. To
            exercise any of these, email{' '}
            <span className="theme-text">[CONTACT EMAIL]</span> and we will respond within the
            timeframe the law requires.
          </p>
          <p>
            If you are in the EU or UK, you also have the right to lodge a complaint with your
            local data protection authority.
          </p>
        </Section>

        <Section title="Children">
          <p>
            typingSeal is not intended for children under 13, and we do not knowingly collect their
            personal information. If you believe a child has given us personal information, contact
            us and we will delete it.
          </p>
        </Section>

        <Section title="Where your data is processed">
          <p>
            Our servers and those of our service providers are located in the United States and
            possibly other countries. If you use typingSeal from elsewhere, your information will
            be transferred to and processed in those locations.
          </p>
        </Section>

        <Section title="Changes to this policy">
          <p>
            If we make a material change to how we handle your information, we will update the date
            at the top of this page and, where appropriate, tell you in the app or by email.
          </p>
        </Section>

        <Section title="Contact">
          <p>
            Questions, requests, or complaints:{' '}
            <span className="theme-text">[CONTACT EMAIL]</span>.
          </p>
        </Section>

        <button
          onClick={() => navigate('/')}
          className="mt-10 font-pixel px-4 py-2 border border-slate-700 theme-text-soft text-sm font-bold transition-colors hover:border-amber-500/60 hover:bg-slate-800"
        >
          ← Back to typingSeal
        </button>
      </div>
    </div>
  );
}
