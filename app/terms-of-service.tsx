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

export default function TermsOfServiceScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={12}>
          <Text style={styles.back}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Terms of Service</Text>
        <Text style={styles.effective}>Effective Date: October 6, 2026</Text>
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Para>
          Welcome to Snap Send. By creating an account or using the Snap Send application, you agree to
          these Terms of Service ("Terms"). Please read them carefully.
        </Para>

        <Section title="1. About Snap Send">
          <Para>
            Snap Send is a mobile application that lets you create personalized postcards from your photos.
            We arrange printing and delivery through our fulfillment partner, the United States Postal
            Service, and destination-country postal services.
          </Para>
        </Section>

        <Section title="2. Eligibility">
          <Para>
            You must be at least 13 years old to use Snap Send. By using the app, you represent and warrant
            that you meet this age requirement. If you are under 18, you represent that a parent or guardian
            has reviewed and agreed to these Terms on your behalf.
          </Para>
        </Section>

        <Section title="3. Your Account">
          <Para>
            You are responsible for maintaining the security of your account credentials and for all activity
            that occurs under your account. Notify us immediately at support@snapsend.live if you believe your
            account has been compromised. We are not liable for any loss resulting from unauthorized use of
            your account.
          </Para>
        </Section>

        <Section title="4. Acceptable Use">
          <Para>
            By using Snap Send, you agree not to submit postcard content that:
          </Para>
          <Bullet>Is illegal, obscene, pornographic, defamatory, threatening, or harassing</Bullet>
          <Bullet>Contains hate speech or content that promotes discrimination, violence, or hostility toward any individual or group based on race, ethnicity, religion, gender, sexual orientation, disability, or national origin</Bullet>
          <Bullet>Infringes on any third party's intellectual property or privacy rights</Bullet>
          <Bullet>Contains spam, advertising, or unsolicited commercial messages</Bullet>
          <Bullet>Depicts minors in any inappropriate manner</Bullet>
          <Bullet>Violates any applicable local, state, national, or international law</Bullet>
          <Para>
            We reserve the right to refuse or cancel any order that violates these guidelines and to suspend
            or terminate accounts that repeatedly violate this policy, without refund.
          </Para>
        </Section>

        <Section title="5. Payments and Refunds">
          <Text style={[styles.subheading, { color: colors.textPrimary }]}>Pricing</Text>
          <Para>
            The price for each postcard is displayed before you complete your purchase. Prices may change
            at any time; the price shown at checkout, including any tax we are required to collect, is what
            you will be charged. Prices are presented in U.S. dollars, and your bank may charge currency
            conversion or international transaction fees.
          </Para>

          <Text style={[styles.subheading, { color: colors.textPrimary }]}>Payment Processing</Text>
          <Para>
            All payments are processed securely through Stripe. By submitting payment, you authorize us
            to charge the displayed amount to your payment method. You agree to Stripe's Terms of Service
            (stripe.com/legal).
          </Para>

          <Text style={[styles.subheading, { color: colors.textPrimary }]}>Refunds</Text>
          <Para>
            Each postcard is personalized to your specifications. Once an order has been submitted to our
            printing partner, it cannot be cancelled or refunded except where required by applicable law.
            If you believe there was an error with your order, contact us at support@snapsend.live within
            1 hour of placing it and we will make every reasonable effort to assist. Refunds for printing
            or delivery errors on our part will be handled on a case-by-case basis.
          </Para>
        </Section>

        <Section title="6. Delivery">
          <Para>
            Domestic postcards are generally mailed through USPS. International postcards are transferred
            to the destination country's postal service. Delivery estimates shown in the app are estimates
            only; international delivery may take several weeks and may be affected by customs, local mail
            service, holidays, or service suspensions.
          </Para>
          <Para>
            We are not responsible for delays, losses, or damages caused by USPS, incorrect recipient
            addresses provided by you, destination postal services, customs authorities, or circumstances
            outside our control. The recipient may be responsible for import charges or postal handling
            fees that are not collected at checkout.
          </Para>
        </Section>

        <Section title="7. International Use and Trade Compliance">
          <Para>
            You may not use Snap Send from, or send postcards to, a country, territory, person, or entity
            restricted by applicable sanctions or export-control laws. Availability may change immediately
            when postal service, payment processing, or legal restrictions change.
          </Para>
          <Para>
            You are responsible for complying with laws that apply to the content you send and for providing
            complete and accurate customs, billing, sender, and recipient information where required.
          </Para>
        </Section>

        <Section title="8. Your Content">
          <Para>
            You retain ownership of the photos and messages you submit through Snap Send. By submitting
            content, you grant us a limited, non-exclusive license to use that content solely to fulfill
            your postcard order. We do not use your postcard content for advertising, marketing, or any
            other purpose without your explicit consent.
          </Para>
          <Para>
            You represent and warrant that you have all necessary rights to the photos and content you
            submit, and that submitting them does not violate any third party's rights.
          </Para>
        </Section>

        <Section title="9. Intellectual Property">
          <Para>
            The Snap Send app, its design, logo, and original content are owned by us and are protected
            by copyright, trademark, and other intellectual property laws. You may not copy, modify,
            distribute, or reverse engineer any part of the app without our written permission.
          </Para>
        </Section>

        <Section title="10. Disclaimer of Warranties">
          <Para>
            Snap Send is provided "as is" and "as available" without warranties of any kind, either
            express or implied, including but not limited to implied warranties of merchantability,
            fitness for a particular purpose, or non-infringement. We do not warrant that the service
            will be uninterrupted, error-free, or that defects will be corrected.
          </Para>
        </Section>

        <Section title="11. Limitation of Liability">
          <Para>
            To the fullest extent permitted by applicable law, Snap Send and its operators shall not be
            liable for any indirect, incidental, special, consequential, or punitive damages arising out
            of or related to your use of the service. Our total liability to you for any claim arising
            from your use of Snap Send shall not exceed the amount you paid for the specific order giving
            rise to the claim.
          </Para>
        </Section>

        <Section title="12. Termination">
          <Para>
            We reserve the right to suspend or terminate your account at any time if you violate these
            Terms or engage in conduct we reasonably believe is harmful to other users, third parties, or
            the integrity of the service. You may also delete your account at any time by contacting
            support@snapsend.live.
          </Para>
        </Section>

        <Section title="13. Changes to These Terms">
          <Para>
            We may update these Terms from time to time. We will notify you of material changes by
            posting the updated Terms within the app. Continued use of Snap Send after changes constitutes
            your acceptance of the revised Terms.
          </Para>
        </Section>

        <Section title="14. Governing Law">
          <Para>
            These Terms are governed by the laws of the United States and the state where Snap Send is
            established, without limiting any mandatory consumer protections that apply in your country.
            Disputes will be resolved in the applicable United States courts unless local law requires
            another forum.
          </Para>
        </Section>

        <Section title="15. Contact Us">
          <Para>
            If you have questions or concerns about these Terms, please contact us at:
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
