import { Stack } from 'expo-router';

export default function AddressModalLayout() {
  return (
    <Stack screenOptions={{ presentation: 'modal', headerShown: false }} />
  );
}
