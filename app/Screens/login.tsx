import React, { useState, useRef, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  Dimensions,
  StatusBar,
  SafeAreaView,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  ActivityIndicator,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import Colors from "@/constants/Colors";
import axios from "axios";
import AsyncStorage from "@react-native-async-storage/async-storage";

const { width, height } = Dimensions.get("window");
const API_BASE_URL = "http://192.168.1.24:3000/api";

const Login = () => {
  const [phoneNumber, setPhoneNumber] = useState("");
  const [isOtpSent, setIsOtpSent] = useState(false);
  const [otp, setOtp] = useState(["", "", "", ""]);
  const [loading, setLoading] = useState(false);
  const [resendDisabled, setResendDisabled] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const otpInputRefs = useRef<Array<TextInput | null>>([]);

  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (countdown > 0) {
      timer = setTimeout(() => setCountdown(countdown - 1), 1000);
    } else {
      setResendDisabled(false);
    }
    return () => clearTimeout(timer);
  }, [countdown]);

  const validatePhoneNumber = () => {
    return phoneNumber.length === 10 && /^\d+$/.test(phoneNumber);
  };

  const handleSendOtp = async () => {
    if (!validatePhoneNumber()) {
      Alert.alert(
        "Invalid Phone Number",
        "Please enter a valid 10-digit phone number"
      );
      return;
    }

    setLoading(true);
    try {
      const response = await axios.post(
        `${API_BASE_URL}/teacher-auth/request-otp`,
        {
          phone: phoneNumber,
        }
      );

      setIsOtpSent(true);
      setResendDisabled(true);
      setCountdown(60); // 60 seconds countdown
      Alert.alert("OTP Sent", `OTP has been sent to +91 ${phoneNumber}`);

      // If we're in development mode and response includes OTP
      if (response.data.otp) {
        // Auto-fill OTP for development purposes
        const devOtp = response.data.otp
          .toString()
          .padStart(4, "0")
          .slice(0, 4);
        const otpArray = devOtp.split("");
        setOtp(otpArray);
      }
    } catch (error: any) {
      if (axios.isAxiosError(error) && error.response) {
        Alert.alert("Error", error.response.data.error || "Failed to send OTP");
      } else {
        Alert.alert("Error", "Network error. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleOtpChange = (text: string, index: number) => {
    const newOtp = [...otp];
    newOtp[index] = text;
    setOtp(newOtp);

    // Auto advance to next input
    if (text.length === 1 && index < 3) {
      otpInputRefs.current[index + 1]?.focus();
    }
  };

  const handleVerifyOtp = async () => {
    const enteredOtp = otp.join("");
    if (enteredOtp.length !== 4) {
      Alert.alert("Invalid OTP", "Please enter a valid 4-digit OTP");
      return;
    }

    setLoading(true);
    try {
      console.log("Verifying OTP with backend...");
      const response = await axios.post(
        `${API_BASE_URL}/teacher-auth/verify-otp`,
        {
          phone: phoneNumber,
          otp: enteredOtp,
        }
      );
      
      console.log("OTP verification successful, saving data...");
      
      // Store the authentication token and anganwadi data
      await AsyncStorage.setItem('authToken', response.data.token);
      
      // Log what we received to help with debugging
      console.log("Response data keys:", Object.keys(response.data));
      
      // Store anganwadi ID for future API calls
      if (response.data.anganwadi?.id) {
        console.log("Storing anganwadi ID:", response.data.anganwadi.id);
        await AsyncStorage.setItem('anganwadiId', response.data.anganwadi.id);
      }
      
      // Store teacher data
      if (response.data.teacher) {
        console.log("Storing teacher data");
        await AsyncStorage.setItem('teacherData', JSON.stringify(response.data.teacher));
      }
      
      // Store basic anganwadi data returned from login
      if (response.data.anganwadi) {
        console.log("Storing anganwadi data from login response");
        await AsyncStorage.setItem('anganwadiData', JSON.stringify(response.data.anganwadi));
      }
      
      // Navigate to home screen
      router.push("/Screens/home");
    } catch (error: any) {
      if (axios.isAxiosError(error) && error.response) {
        Alert.alert(
          "Verification Failed",
          error.response.data.error || "Invalid OTP"
        );
      } else {
        Alert.alert("Error", "Network error. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor={Colors.background} />
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={styles.keyboardAvoid}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContainer}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.container}>
            <View style={styles.header}>
              <Text style={styles.title}>Welcome</Text>
              <View style={styles.titleUnderline} />
            </View>

            <View style={styles.contentContainer}>
              <View style={styles.card}>
                {!isOtpSent ? (
                  <>
                    <Text style={styles.cardTitle}>Enter Phone Number</Text>
                    <Text style={styles.cardSubtitle}>
                      We'll send you a one-time password to verify your account
                    </Text>
                    <View style={styles.phoneInputContainer}>
                      <View style={styles.countryCode}>
                        <Text style={styles.countryCodeText}>+91</Text>
                      </View>
                      <TextInput
                        style={styles.phoneInput}
                        value={phoneNumber}
                        onChangeText={setPhoneNumber}
                        placeholder="Enter 10-digit number"
                        keyboardType="phone-pad"
                        maxLength={10}
                      />
                    </View>
                    <LinearGradient
                      colors={[Colors.primary, Colors.primary + "DD"]}
                      style={styles.buttonContainer}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 1 }}
                    >
                      <TouchableOpacity
                        style={styles.button}
                        onPress={handleSendOtp}
                        activeOpacity={0.85}
                        disabled={loading}
                      >
                        {loading ? (
                          <ActivityIndicator color="#FFFFFF" size="small" />
                        ) : (
                          <Text style={styles.buttonText}>Send OTP</Text>
                        )}
                      </TouchableOpacity>
                    </LinearGradient>
                  </>
                ) : (
                  <>
                    <Text style={styles.cardTitle}>Enter OTP</Text>
                    <Text style={styles.cardSubtitle}>
                      We've sent a 4-digit code to +91 {phoneNumber}
                    </Text>
                    <View style={styles.otpContainer}>
                      {[0, 1, 2, 3].map((index) => (
                        <TextInput
                          key={index}
                          style={styles.otpInput}
                          keyboardType="number-pad"
                          maxLength={1}
                          value={otp[index]}
                          onChangeText={(text) => handleOtpChange(text, index)}
                          ref={(ref) => (otpInputRefs.current[index] = ref)}
                        />
                      ))}
                    </View>
                    <LinearGradient
                      colors={[Colors.primary, Colors.primary + "DD"]}
                      style={styles.buttonContainer}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 1 }}
                    >
                      <TouchableOpacity
                        style={styles.button}
                        onPress={handleVerifyOtp}
                        activeOpacity={0.85}
                        disabled={loading}
                      >
                        {loading ? (
                          <ActivityIndicator color="#FFFFFF" size="small" />
                        ) : (
                          <Text style={styles.buttonText}>Verify OTP</Text>
                        )}
                      </TouchableOpacity>
                    </LinearGradient>
                    <TouchableOpacity
                      style={styles.resendButton}
                      onPress={handleSendOtp}
                      disabled={resendDisabled}
                    >
                      <Text
                        style={[
                          styles.resendText,
                          resendDisabled && styles.disabledText,
                        ]}
                      >
                        {resendDisabled
                          ? `Resend OTP in ${countdown}s`
                          : "Resend OTP"}
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.changeNumberButton}
                      onPress={() => setIsOtpSent(false)}
                    >
                      <Text style={styles.changeNumberText}>
                        Change Phone Number
                      </Text>
                    </TouchableOpacity>
                  </>
                )}
              </View>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

export default Login;

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  keyboardAvoid: {
    flex: 1,
  },
  scrollContainer: {
    flexGrow: 1,
  },
  container: {
    flex: 1,
    alignItems: "center",
    paddingVertical: height * 0.05,
    backgroundColor: Colors.background,
  },
  header: {
    alignItems: "center",
    paddingTop: height * 0.02,
    marginBottom: height * 0.05,
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
  contentContainer: {
    width: "100%",
    alignItems: "center",
    paddingHorizontal: width * 0.07,
  },
  card: {
    backgroundColor: Colors.surface,
    borderRadius: 20,
    padding: 24,
    width: "100%",
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 5,
  },
  cardTitle: {
    fontSize: Math.min(22, width * 0.055),
    fontWeight: "700",
    color: Colors.textPrimary,
    marginBottom: 10,
    textAlign: "center",
  },
  cardSubtitle: {
    fontSize: Math.min(16, width * 0.04),
    color: Colors.textSecondary,
    marginBottom: 25,
    textAlign: "center",
  },
  phoneInputContainer: {
    flexDirection: "row",
    marginBottom: 30,
  },
  countryCode: {
    backgroundColor: Colors.inputBackground,
    paddingHorizontal: 15,
    paddingVertical: 12,
    borderRadius: 12,
    marginRight: 10,
    justifyContent: "center",
  },
  countryCodeText: {
    fontSize: 16,
    fontWeight: "600",
    color: Colors.textPrimary,
  },
  phoneInput: {
    flex: 1,
    backgroundColor: Colors.inputBackground,
    paddingHorizontal: 15,
    paddingVertical: 12,
    borderRadius: 12,
    fontSize: 16,
    color: Colors.textPrimary,
  },
  buttonContainer: {
    width: "100%",
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
  otpContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 30,
  },
  otpInput: {
    width: "22%",
    height: 60,
    backgroundColor: Colors.inputBackground,
    borderRadius: 12,
    fontSize: 24,
    fontWeight: "bold",
    textAlign: "center",
    color: Colors.textPrimary,
  },
  resendButton: {
    alignItems: "center",
    marginTop: 20,
  },
  resendText: {
    fontSize: 16,
    fontWeight: "600",
    color: Colors.primary,
  },
  disabledText: {
    color: Colors.textSecondary,
    opacity: 0.7,
  },
  changeNumberButton: {
    alignItems: "center",
    marginTop: 15,
  },
  changeNumberText: {
    fontSize: 14,
    color: Colors.textSecondary,
  },
});
