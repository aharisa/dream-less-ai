import { Stack } from "expo-router";

export default function RootLayout() {
  return <Stack>
    <Stack.Screen
        name="index" // this targets app/index.tsx
        options={{
          title: "Dream App",           // This will show in the header
          headerTitleAlign: "center", // optional: centers the title (iOS/Android)
          headerStyle: { backgroundColor: "#f4511e" }, // optional styling
          headerTintColor: "#fff",                    // optional text color
        }}
      />
  </Stack>;
}
