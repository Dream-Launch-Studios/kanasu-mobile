import React, { useRef, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
  StatusBar,
  SafeAreaView,
} from "react-native";
import LottieView from "lottie-react-native";
import Colors from "@/constants/Colors";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
const { width, height } = Dimensions.get("window");

const Onboarding = () => {
  const animation = useRef<LottieView | null>(null);

  useEffect(() => {
    if (animation.current) {
      animation.current.play();
    }
  }, []);

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor={Colors.background} />

      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>Kanasu</Text>
          <View style={styles.titleUnderline} />
        </View>

        <View style={styles.animationWrapper}>
          <LottieView
            autoPlay
            ref={animation}
            loop={true}
            style={styles.animation}
            source={require("@/assets/animation/Main.json")}
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
              <Text style={styles.buttonText}>Get Started</Text>
            </TouchableOpacity>
          </LinearGradient>
        </View>
      </View>
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
  animationWrapper: {
    width: width * 0.85,
    height: width * 0.85,
    borderRadius: 30,
    overflow: "hidden",
    backgroundColor: "#f8f9fa",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 6,
    },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 8,
  },
  animation: {
    width: width * 0.8,
    height: width * 0.8,
    backgroundColor: "transparent",
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
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
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
});
