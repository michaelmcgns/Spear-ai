export default function PrivacyPolicyPage() {
  return (
    <main className="min-h-screen bg-[#0a1628] text-[#e8d5b0] px-6 py-16 max-w-4xl mx-auto">
      <h1 className="text-4xl font-bold mb-2">Privacy Policy</h1>
      <p className="text-sm text-[#e8d5b0]/60 mb-12">Effective Date: May 26, 2026</p>

      <section className="space-y-10 text-[#e8d5b0]/80 leading-relaxed">
        <div>
          <h2 className="text-xl font-semibold text-[#e8d5b0] mb-3">1. Overview</h2>
          <p>
            Spear Sales AI LLC (&quot;Spear&quot;, &quot;we&quot;, &quot;us&quot;) operates spearai.live. This Privacy
            Policy explains what data we collect, how we use it, and your rights regarding that data. By using Spear,
            you agree to the practices described in this policy.
          </p>
        </div>

        <div>
          <h2 className="text-xl font-semibold text-[#e8d5b0] mb-3">2. Information We Collect</h2>
          <p className="mb-3">
            <strong className="text-[#e8d5b0]">Account Information:</strong> Name, email address, and password when you
            create an account.
          </p>
          <p className="mb-3">
            <strong className="text-[#e8d5b0]">Payment Information:</strong> Billing details processed securely through
            Stripe. Spear does not store your full card number.
          </p>
          <p className="mb-3">
            <strong className="text-[#e8d5b0]">Call Audio and Transcripts:</strong> Spear processes real-time audio
            through your device microphone to generate coaching suggestions. Audio is processed in real time and is not
            permanently stored unless you explicitly save a session.
          </p>
          <p>
            <strong className="text-[#e8d5b0]">Usage Data:</strong> Information about how you use the platform including
            pages visited, features used, and session duration.
          </p>
        </div>

        <div>
          <h2 className="text-xl font-semibold text-[#e8d5b0] mb-3">3. How We Use Your Information</h2>
          <p>
            We use your information to provide and improve the Spear platform; process payments and manage your
            subscription; send product updates, feature announcements, and support communications; analyze usage
            patterns to improve coaching quality; and comply with legal obligations.
          </p>
        </div>

        <div>
          <h2 className="text-xl font-semibold text-[#e8d5b0] mb-3">4. Call Audio and AI Processing</h2>
          <p>
            Spear uses your device microphone to listen to call audio in real time. This audio is sent to third-party
            AI providers (including Deepgram for transcription and Anthropic for coaching analysis) solely for the
            purpose of generating real-time coaching suggestions. We do not sell your call audio or transcripts to
            third parties. You are responsible for obtaining proper consent from call participants before using Spear
            on any call.
          </p>
        </div>

        <div>
          <h2 className="text-xl font-semibold text-[#e8d5b0] mb-3">5. Data Sharing</h2>
          <p>
            We do not sell your personal data. We may share data with trusted third-party service providers who assist
            in operating the platform, including Supabase (database), Stripe (payments), Deepgram (transcription), and
            Anthropic (AI coaching). These providers are contractually obligated to protect your data.
          </p>
        </div>

        <div>
          <h2 className="text-xl font-semibold text-[#e8d5b0] mb-3">6. Data Retention</h2>
          <p>
            We retain your account data for as long as your account is active. Real-time call audio is not stored
            permanently. Saved call sessions are retained until you delete them or close your account. You may request
            deletion of your data at any time by contacting us.
          </p>
        </div>

        <div>
          <h2 className="text-xl font-semibold text-[#e8d5b0] mb-3">7. Security</h2>
          <p>
            We implement industry-standard security measures including encrypted data transmission (HTTPS), secure
            authentication, and access controls. No system is completely secure, and we cannot guarantee absolute
            security of your data.
          </p>
        </div>

        <div>
          <h2 className="text-xl font-semibold text-[#e8d5b0] mb-3">8. Your Rights</h2>
          <p>
            You have the right to access, correct, or delete your personal data at any time. To exercise these rights,
            contact us at{" "}
            <a href="mailto:support@spearai.live" className="underline">
              support@spearai.live
            </a>
            . We will respond within 30 days.
          </p>
        </div>

        <div>
          <h2 className="text-xl font-semibold text-[#e8d5b0] mb-3">9. Cookies</h2>
          <p>Spear uses essential cookies to maintain your session and authentication state. We do not use advertising or tracking cookies.</p>
        </div>

        <div>
          <h2 className="text-xl font-semibold text-[#e8d5b0] mb-3">10. Children&apos;s Privacy</h2>
          <p>Spear is not intended for users under 18 years of age. We do not knowingly collect data from minors.</p>
        </div>

        <div>
          <h2 className="text-xl font-semibold text-[#e8d5b0] mb-3">11. Changes to This Policy</h2>
          <p>
            We may update this Privacy Policy from time to time. We will notify you of significant changes by email or
            by posting a notice on the platform. Continued use of Spear after changes constitutes acceptance of the
            updated policy.
          </p>
        </div>

        <div>
          <h2 className="text-xl font-semibold text-[#e8d5b0] mb-3">12. Contact</h2>
          <p>
            Questions about this Privacy Policy? Contact us at{" "}
            <a href="mailto:support@spearai.live" className="underline">
              support@spearai.live
            </a>
          </p>
        </div>
      </section>
    </main>
  );
}

