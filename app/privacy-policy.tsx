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
        <Text style={styles.effective}>Effective Date: March 31, 2026</Text>
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Para>
          Snap Send ("we," "our," or "us") is committed to protecting your privacy. This Privacy Policy
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

          <Text style={[styles.subheading, { color: colors.textPrimary }]}>Postcard Content</Text>
          <Para>
            We collect the photos you upload and messages you write for your postcards. This content is
            transmitted to our printing partner solely to fulfill your order.
          </Para>

          <Text style={[styles.subheading, { color: colors.textPrimary }]}>Payment Information</Text>
          <Para>
            Payments are processed by Stripe, Inc. We do not store your full card number, CVV, or other
            sensitive payment details on our servers. Stripe retains payment information per their own
            Privacy Policy (stripe.com/privacy).
          </Para>

          <Text style={[styles.subheading, { color: colors.textPrimary }]}>Usage Data</Text>
          <Para>
            We may collect information about how you use the app — such as order history and in-app
            activity — to improve our service.
          </Para>
        </Section>

        <Section title="2. How We Use Your Information">
          <Para>We use the information we collect to:</Para>
          <Bullet>Create and manage your account</Bullet>
          <Bullet>Process and fulfill postcard orders</Bullet>
          <Bullet>Communicate with you about your orders or account</Bullet>
          <Bullet>Improve and maintain the Snap Send service</Bullet>
          <Bullet>Comply with legal obligations</Bullet>
        </Section>

        <Section title="3. How We Share Your Information">
          <Para>
            We share information with trusted third-party service providers who help us operate Snap Send:
          </Para>
          <Bullet>Stripe — payment processing (stripe.com/privacy)</Bullet>
          <Bullet>Supabase — authentication, database, and file storage (supabase.com/privacy)</Bullet>
          <Bullet>Google — sign-in via Google OAuth (policies.google.com/privacy)</Bullet>
          <Bullet>Apple — sign-in via Apple (apple.com/legal/privacy)</Bullet>
          <Bullet>
            Postcard Printing Partner — your photo, message, and recipient address are shared with
            our fulfillment partner to produce and mail your postcard.
          </Bullet>
          <Para>We do not sell your personal information to third parties.</Para>
        </Section>

        <Section title="4. Data Retention">
          <Para>
            We retain your account information and order history for as long as your account is active.
            You may request deletion of your data by contacting us at support@snapsend.live. We process
            deletion requests within 48 hours.
          </Para>
        </Section>

        <Section title="5. Data Security">
          <Para>
            We take reasonable measures to protect your information using industry-standard secure
            infrastructure. However, no method of internet transmission is 100% secure and we cannot
            guarantee absolute security.
          </Para>
        </Section>

        <Section title="6. Children's Privacy">
          <Para>
            Snap Send is not intended for use by children under the age of 13. We do not knowingly
            collect personal information from children under 13. If you believe a child has provided
            us their information, please contact us and we will promptly delete it.
          </Para>
        </Section>

        <Section title="7. Changes to This Policy">
          <Para>
            We may update this Privacy Policy from time to time. We will notify you of material changes
            by posting the updated policy within the app. Continued use of Snap Send after changes
            constitutes your acceptance of the revised policy.
          </Para>
        </Section>

        <Section title="8. Contact Us">
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
