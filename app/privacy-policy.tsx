import { useMemo } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '@/hooks/useTheme';
import type { AppColors } from '@/constants/theme';
import { FONT_SIZE, SPACING } from '@/constants/theme';

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  const { colors } = useTheme();
  return (
    <View style={{ gap: SPACING.xs }}>
      <Text style={{ fontSize: FONT_SIZE.md, fontWeight: '700', color: colors.textPrimary, marginTop: SPACING.md }}>
        {title}
      </Text>
      {children}
    </View>
  );
}

function Para({ children }: { children: React.ReactNode }) {
  const { colors } = useTheme();
  return (
    <Text style={{ fontSize: FONT_SIZE.sm, color: colors.textSecondary, lineHeight: 22 }}>
      {children}
    </Text>
  );
}

function Bullet({ children }: { children: string }) {
  const { colors } = useTheme();
  return (
    <Text style={{ fontSize: FONT_SIZE.sm, color: colors.textSecondary, lineHeight: 22, paddingLeft: SPACING.md }}>
      {'• '}{children}
    </Text>
  );
}

export default function PrivacyPolicyScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={12}>
          <Text style={styles.back}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Privacy Policy</Text>
        <Text style={styles.effective}>Effective Date: November 12, 2026</Text>
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Para>
          Snap Send (&quot;we,&quot; &quot;our,&quot; or &quot;us&quot;) is committed to protecting your privacy. This Privacy Policy
          explains how we collect, use, and share your information when you use the Snap Send mobile application.
        </Para>

        <Section title="1. Information We Collect">
          <Text style={[styles.subheading, { color: colors.textPrimary }]}>Account Information</Text>
          <Para>
            When you create an account, we collect your full name, email address, and a securely hashed
            password. If you sign in with Google or Apple, we receive your name and email from those providers.
          </Para>

          <Text style={[styles.subheading, { color: colors.textPrimary }]}>Mailing Addresses</Text>
          <Para>
            We collect mailing addresses you save in the app — including your personal return address and
            the addresses of postcard recipients. This information is required to print and deliver your postcards.
          </Para>

          <Text style={[styles.subheading, { color: colors.textPrimary }]}>Address Requests</Text>
          <Para>
            If you ask a recipient for their address by email, we collect and store that person&apos;s email
            address, send them a link to view your postcard, and keep your postcard image and message for up
            to 45 days to power that link. When the recipient enters their mailing address, it is verified,
            saved to your address book, and used to print and mail your postcard. Postcard images are deleted
            when the request is completed, refunded, or expires. We send reminder emails to the recipient and
            to you while no address has been entered.
          </Para>

          <Text style={[styles.subheading, { color: colors.textPrimary }]}>Postcard Content</Text>
          <Para>
            We collect the photos you upload and messages you write for your postcards. This content is
            transmitted to our printing partner solely to fulfill your order.
          </Para>

          <Text style={[styles.subheading, { color: colors.textPrimary }]}>Location (Optional)</Text>
          <Para>
            If you choose to add a location to your postcard, Snap Send can use your device&apos;s approximate location
            (with your permission) to suggest nearby places. Your coordinates, or the place name you
            type, are sent to the OpenStreetMap Nominatim service to look up place names. We do not store
            your device location. You can decline the permission and type a location instead, or skip it.
          </Para>

          <Text style={[styles.subheading, { color: colors.textPrimary }]}>Contacts (Optional)</Text>
          <Para>
            If you choose to import an address from your contacts, Snap Send opens your device&apos;s contact
            picker. We only receive the single contact you select, and only to fill in the address
            form. We do not read or upload the rest of your contacts.
          </Para>

          <Text style={[styles.subheading, { color: colors.textPrimary }]}>Saved Drafts</Text>
          <Para>
            If you save a postcard draft, the photo, message, and choices are stored only on your device.
            They are not sent to us until you send the postcard, and they are removed when you delete
            the draft, send the postcard, or uninstall the app.
          </Para>

          <Text style={[styles.subheading, { color: colors.textPrimary }]}>Payment Information</Text>
          <Para>
            Payments are processed by Stripe, Inc. We do not store your full card number, CVV, or other
            sensitive payment details on our servers. Stripe retains payment information per their own
            Privacy Policy (stripe.com/privacy).
          </Para>
          <Para>
            We retain limited transaction records needed to operate the service and meet accounting,
            tax, fraud-prevention, and legal obligations. These records may include Stripe transaction
            identifiers, purchase and refund dates, amounts, currency, tax amounts, and billing and
            destination country codes. They do not include your full card number or CVV.
          </Para>

          <Text style={[styles.subheading, { color: colors.textPrimary }]}>Usage Data</Text>
          <Para>
            We collect information about how you use the app — such as order history and in-app
            activity — to improve our service. We use Google Analytics for Firebase, a service
            provided by Google, to collect analytics data such as when you first open or install
            the app, the screens you view, actions you take (for example signing up, starting a
            postcard, or completing a purchase), basic device and app information (such as device
            model, operating system, app version, and approximate location derived from your IP
            address), and a unique app-instance identifier. If you are signed in, we also associate
            your account ID with this data. Google processes this data under its own privacy policy
            (policies.google.com/privacy). We use it only to understand and improve Snap Send; we do
            not use it for third-party advertising.
          </Para>
          <Para>
            If you are in the European Economic Area, the United Kingdom, or Switzerland, analytics
            is off until you choose to allow it: we ask for your consent the first time you open the
            app, and we rely on that consent as our legal basis. You can withdraw or change your
            choice at any time in Settings → Privacy → Share usage analytics. In other regions,
            analytics is on by default and you can turn it off in the same place. When turned off,
            the app stops sending analytics data and resets its analytics identifier.
          </Para>
        </Section>

        <Section title="2. How We Use Your Information">
          <Para>We use the information we collect to:</Para>
          <Bullet>Create and manage your account</Bullet>
          <Bullet>Process and fulfill postcard orders</Bullet>
          <Bullet>Communicate with you about your orders or account</Bullet>
          <Bullet>Improve and maintain the Snap Send service, including through usage analytics</Bullet>
          <Bullet>Maintain transaction, refund, and country-level compliance records</Bullet>
          <Bullet>Comply with legal obligations</Bullet>
        </Section>

        <Section title="3. How We Share Your Information">
          <Para>
            We share information with trusted third-party service providers who help us operate Snap Send:
          </Para>
          <Bullet>Stripe — payment processing (stripe.com/privacy)</Bullet>
          <Bullet>Supabase — authentication, database, and file storage (supabase.com/privacy)</Bullet>
          <Bullet>Google — sign-in via Google OAuth (policies.google.com/privacy)</Bullet>
          <Bullet>Google Analytics for Firebase — app usage analytics (policies.google.com/privacy)</Bullet>
          <Bullet>Google Cloud Vision — automated safety screening of postcard images</Bullet>
          <Bullet>Apple — sign-in via Apple (apple.com/legal/privacy)</Bullet>
          <Bullet>Resend — delivery of transactional emails such as refund confirmations (resend.com/legal/privacy-policy)</Bullet>
          <Bullet>OpenStreetMap Nominatim — optional place lookup when you add a location to a postcard (osmfoundation.org/wiki/Privacy_Policy)</Bullet>
          <Bullet>
            Lob — your photo, message, sender address, and recipient address are shared with our
            fulfillment partner to produce and mail your postcard (lob.com/legal/privacy).
          </Bullet>
          <Para>We do not sell your personal information to third parties.</Para>
        </Section>

        <Section title="4. International Data Transfers">
          <Para>
            Snap Send is operated from the United States. If you use the app from another country, your
            information may be transferred to and processed in the United States and other countries where
            our service providers operate. We use service-provider agreements and other safeguards required
            by applicable law for these transfers.
          </Para>
        </Section>

        <Section title="5. Your Privacy Rights">
          <Para>
            Depending on where you live, you may have rights to access, correct, delete, restrict, or obtain
            a copy of your personal information, or to object to certain processing. You may delete your
            account in the app or contact support@snapsend.live to exercise a privacy right. You may also
            have the right to complain to your local data-protection authority.
          </Para>
        </Section>

        <Section title="6. Data Retention">
          <Para>
            We retain your account information and order history for as long as your account is active.
            You may request deletion of your data by contacting us at support@snapsend.live. We process
            account-deletion requests within 48 hours. We may retain transaction, tax, fraud-prevention,
            dispute, and other records for the period required by law or reasonably necessary to establish,
            exercise, or defend legal claims. Where practical, retained records are minimized or
            de-identified.
          </Para>
        </Section>

        <Section title="7. Data Security">
          <Para>
            We take reasonable measures to protect your information using industry-standard secure
            infrastructure. However, no method of internet transmission is 100% secure and we cannot
            guarantee absolute security.
          </Para>
        </Section>

        <Section title="8. Children's Privacy">
          <Para>
            Snap Send is not intended for use by children under the age of 13. We do not knowingly
            collect personal information from children under 13. If you believe a child has provided
            us their information, please contact us and we will promptly delete it.
          </Para>
        </Section>

        <Section title="9. Changes to This Policy">
          <Para>
            We may update this Privacy Policy from time to time. We will notify you of material changes
            by posting the updated policy within the app. Continued use of Snap Send after changes
            constitutes your acceptance of the revised policy.
          </Para>
        </Section>

        <Section title="10. Contact Us">
          <Para>
            If you have questions or concerns about this Privacy Policy, please contact us at:
          </Para>
          <Text style={{ fontSize: FONT_SIZE.sm, color: colors.primary, fontWeight: '600', marginTop: SPACING.xs }}>
            support@snapsend.live
          </Text>
        </Section>

        <View style={styles.footer} />
      </ScrollView>
    </SafeAreaView>
  );
}

function makeStyles(colors: AppColors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    header: {
      paddingHorizontal: SPACING.xl,
      paddingTop: SPACING.md,
      paddingBottom: SPACING.md,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
      gap: SPACING.xs,
    },
    back: { fontSize: FONT_SIZE.md, color: colors.primary, marginBottom: SPACING.xs },
    title: { fontSize: FONT_SIZE.xl, fontWeight: '700', color: colors.textPrimary },
    effective: { fontSize: FONT_SIZE.xs, color: colors.textSecondary },
    content: { padding: SPACING.xl, gap: SPACING.sm },
    subheading: { fontSize: FONT_SIZE.sm, fontWeight: '600', marginTop: SPACING.xs },
    footer: { height: 40 },
  });
}
