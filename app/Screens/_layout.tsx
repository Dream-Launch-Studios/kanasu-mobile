import React from "react";
import { Stack } from "expo-router";

export default function ScreensLayout() {
  return (
    <Stack>
      <Stack.Screen
        name="login"
        options={{
          headerShown: false,
        }}
      />
      <Stack.Screen
        name="home"
        options={{
          headerShown: false,
        }}
      />
      <Stack.Screen
        name="students"
        options={{
          headerShown: false,
        }}
      />
      <Stack.Screen
        name="assessments"
        options={{
          headerShown: false,
        }}
      />
      <Stack.Screen
        name="takeAssessment"
        options={{
          headerShown: false,
        }}
      />
      <Stack.Screen
        name="pendingUploads"
        options={{
          headerShown: false,
        }}
      />
      <Stack.Screen
        name="settings"
        options={{
          headerShown: false,
        }}
      />
    </Stack>
  );
}
