import { Stack } from 'expo-router';

export default function Layout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      {/* Dizemos ao Expo que existem estas duas páginas */}
      <Stack.Screen name="index" />
      <Stack.Screen name="painel" />
    </Stack>
  );
}