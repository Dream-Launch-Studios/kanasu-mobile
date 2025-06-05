import React, { useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
  StatusBar,
  SafeAreaView,
  Image,
} from "react-native";
import Colors from "@/constants/Colors";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import Animated, { FadeIn } from "react-native-reanimated";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { API_URL } from "@/constants/api";
const { width, height } = Dimensions.get("window");

const Onboarding = () => {
  useEffect(() => {
    const checkAuthToken = async () => {
      try {
        console.log(API_URL);
        const authToken = await AsyncStorage.getItem("authToken");
        if (authToken) {
          // If authToken exists, redirect to home page
          router.replace("/Screens/home");
        }
      } catch (error) {
        console.error("Error checking auth token:", error);
      }
    };

    checkAuthToken();
  }, []);

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor={Colors.background} />

      <Animated.View entering={FadeIn.duration(1000)} style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>Kanasu</Text>
          <View style={styles.titleUnderline} />
          <View style={styles.poweredByDivider} />
          <View style={styles.poweredByContainer}>
            <Text style={styles.poweredByText}>Powered by</Text>
            <Image
              source={require("@/assets/images/logo.png")}
              style={styles.companyLogo}
              resizeMode="contain"
            />
          </View>
        </View>

        <View style={styles.animationWrapper}>
          <View style={styles.backgroundPattern}>
            <View style={[styles.patternCircle, styles.patternCircle1]} />
            <View style={[styles.patternCircle, styles.patternCircle2]} />
            <View style={[styles.patternCircle, styles.patternCircle3]} />
          </View>
          <LinearGradient
            colors={["rgba(255,255,255,0.9)", "rgba(255,255,255,0.6)"]}
            style={styles.gradientOverlay}
          />
          <Image
            source={require("@/assets/icon/teacher.png")}
            style={styles.animation}
            resizeMode="contain"
          />
        </View>

        <View style={styles.contentContainer}>
          <View style={styles.subtitleContainer}>
            <Text style={styles.subtitle}>
              Empowering Anganwadi teachers to evaluate and uplift every child's
              learning journey.
            </Text>
          </View>

          <LinearGradient
            colors={[Colors.primary, Colors.primary + "DD"]}
            style={styles.buttonContainer}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
          >
            <TouchableOpacity
              style={styles.button}
              onPress={() => router.push("/Screens/login")}
              activeOpacity={0.85}
            >
              <Text style={styles.buttonText}>Get Started | ಪ್ರಾರಂಭಿಸಿ</Text>
            </TouchableOpacity>
          </LinearGradient>
        </View>
      </Animated.View>
    </SafeAreaView>
  );
};

export default Onboarding;

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#FFFFFF",
  },
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: height * 0.05,
    backgroundColor: "#FFFFFF",
  },
  header: {
    alignItems: "center",
    paddingTop: height * 0.02,
  },
  title: {
    fontSize: Math.min(42, width * 0.1),
    fontWeight: "900",
    color: Colors.textPrimary,
    letterSpacing: 1.5,
  },
  titleUnderline: {
    width: width * 0.2,
    height: 3,
    backgroundColor: Colors.primary,
    marginTop: 6,
    borderRadius: 10,
  },
  poweredByDivider: {
    width: width * 0.18,
    height: 2,
    backgroundColor: Colors.primary + "33",
    borderRadius: 2,
    marginTop: 18,
    marginBottom: 2,
  },
  animationWrapper: {
    width: width * 0.85,
    height: width * 0.85,
    borderRadius: 30,
    overflow: "hidden",
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 6,
    },
    shadowOpacity: 0.1,
    shadowRadius: 5,
    elevation: 2,
    position: "relative",
  },
  backgroundPattern: {
    position: "absolute",
    width: "100%",
    height: "100%",
    opacity: 1,
  },
  patternCircle: {
    position: "absolute",
    borderRadius: 999,
    backgroundColor: Colors.primary + "40",
  },
  patternCircle1: {
    width: width * 0.5,
    height: width * 0.5,
    top: -width * 0.15,
    left: -width * 0.15,
    backgroundColor: Colors.primary + "30",
  },
  patternCircle2: {
    width: width * 0.4,
    height: width * 0.4,
    bottom: -width * 0.1,
    right: -width * 0.1,
    backgroundColor: Colors.primary + "35",
  },
  patternCircle3: {
    width: width * 0.35,
    height: width * 0.35,
    top: width * 0.25,
    left: width * 0.25,
    backgroundColor: Colors.primary + "25",
  },
  gradientOverlay: {
    position: "absolute",
    width: "100%",
    height: "100%",
    zIndex: 1,
    opacity: 0.7,
  },
  animation: {
    width: "90%",
    height: "90%",
    zIndex: 2,
  },
  contentContainer: {
    width: "100%",
    alignItems: "center",
    paddingHorizontal: width * 0.07,
    marginTop: 20,
    marginBottom: 30,
  },
  subtitleContainer: {
    backgroundColor: "#f8f9fa",
    padding: 18,
    borderRadius: 16,
    marginBottom: 30,
    width: "100%",
    shadowColor: "#000",
    borderWidth: 2,
    borderStyle: "dashed",
    borderColor: Colors.border,
  },
  subtitle: {
    fontSize: Math.min(17, width * 0.043),
    fontWeight: "500",
    color: Colors.textSecondary,
    textAlign: "center",
    lineHeight: 26,
  },
  buttonContainer: {
    width: "90%",
    borderRadius: 16,
    overflow: "hidden",
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 7,
  },
  button: {
    width: "100%",
    paddingVertical: Math.min(18, height * 0.025),
    alignItems: "center",
  },
  buttonText: {
    color: "#FFFFFF",
    fontSize: Math.min(18, width * 0.045),
    fontWeight: "700",
    letterSpacing: 0.6,
  },
  poweredByContainer: {
    alignItems: "center",
    borderRadius: 14,
    paddingVertical: 8,
    paddingHorizontal: 18,
    marginTop: 6,
    gap: 2,
  },
  poweredByText: {
    fontSize: 12,
    color: Colors.textSecondary,
    fontStyle: "italic",
    fontWeight: "400",
    opacity: 0.7,
    marginBottom: 2,
  },
  companyLogo: {
    width: width * 0.22,
    height: width * 0.09,
    marginTop: 2,
  },
});
