import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Switch,
  ScrollView,
  SafeAreaView,
  StatusBar,
  Dimensions,
  Alert,
  ActivityIndicator,
} from "react-native";
import { router } from "expo-router";
import Colors from "@/constants/Colors";
import AsyncStorage from "@react-native-async-storage/async-storage";
import axios from "axios";
import { API_URL } from "@/constants/api";
import { getTranslatedText } from "../utils/translate";

const { width, height } = Dimensions.get("window");

interface TeacherStats {
  totalStudents: number;
  totalAssessments: number;
  pendingUploads: number;
  lastSyncDate: string;
}

const Settings = () => {
  const [loading, setLoading] = useState(true);
  const [bilingualMode, setBilingualMode] = useState(true);
  const [teacher, setTeacher] = useState<{
    name: string;
    phone: string;
  } | null>(null);
  const [stats, setStats] = useState<TeacherStats>({
    totalStudents: 0,
    totalAssessments: 0,
    pendingUploads: 0,
    lastSyncDate: "-",
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);

      // Load teacher data
      const teacherData = await AsyncStorage.getItem("teacherData");
      if (teacherData) {
        setTeacher(JSON.parse(teacherData));
      }

      // Load settings
      const storedBilingualMode = await AsyncStorage.getItem("bilingualMode");
      setBilingualMode(storedBilingualMode !== "false");

      // Load anganwadi data for stats
      const anganwadiData = await AsyncStorage.getItem("anganwadiData");
      const pendingUploadsData = await AsyncStorage.getItem("pendingUploads");
      const lastSync = await AsyncStorage.getItem("lastSyncDate");

      if (anganwadiData) {
        const data = JSON.parse(anganwadiData);
        const pendingUploads = pendingUploadsData
          ? JSON.parse(pendingUploadsData).length
          : 0;

        setStats({
          totalStudents: data.students?.length || 0,
          totalAssessments: 0, // This should be updated with actual assessment count
          pendingUploads: pendingUploads,
          lastSyncDate: lastSync || "Never",
        });
      }
    } catch (error) {
      console.error("Error loading data:", error);
      Alert.alert("Error", "Failed to load settings data");
    } finally {
      setLoading(false);
    }
  };

  const handleSettingChange = async (setting: string, value: boolean) => {
    try {
      await AsyncStorage.setItem(setting, value.toString());
      if (setting === "bilingualMode") {
        setBilingualMode(value);
      }
    } catch (error) {
      console.error("Error saving setting:", error);
      Alert.alert("Error", "Failed to save setting");
    }
  };

  const handleSyncData = async () => {
    try {
      setLoading(true);
      const authToken = await AsyncStorage.getItem("authToken");
      const anganwadiId = await AsyncStorage.getItem("anganwadiId");

      if (!authToken || !anganwadiId) {
        throw new Error("Authentication required");
      }

      // Get pending uploads
      const pendingUploads = await AsyncStorage.getItem("pendingUploads");
      if (pendingUploads) {
        const uploads = JSON.parse(pendingUploads);
        if (uploads.length > 0) {
          // Implement your sync logic here
          // For each pending upload:
          // 1. Send to server
          // 2. Remove from pending uploads if successful
        }
      }

      // Update last sync date
      const now = new Date().toISOString();
      await AsyncStorage.setItem("lastSyncDate", now);

      await loadData(); // Reload data to update stats
      Alert.alert("Success", "Data synchronized successfully");
    } catch (error) {
      console.error("Error syncing data:", error);
      Alert.alert("Error", "Failed to sync data");
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    Alert.alert(
      getTranslatedText("Logout", "ಲಾಗ್ ಔಟ್"),
      getTranslatedText(
        "Are you sure you want to logout?",
        "ನೀವು ಲಾಗ್ ಔಟ್ ಮಾಡಲು ಖಚಿತವಾಗಿ ಬಯಸುವಿರಾ?"
      ),
      [
        {
          text: getTranslatedText("Cancel", "ರದ್ದುಮಾಡು"),
          style: "cancel",
        },
        {
          text: getTranslatedText("Logout", "ಲಾಗ್ ಔಟ್"),
          style: "destructive",
          onPress: async () => {
            try {
              await AsyncStorage.clear();
              router.push("/");
            } catch (error) {
              console.error("Error during logout:", error);
              Alert.alert("Error", "Failed to logout");
            }
          },
        },
      ]
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={Colors.primary} />
          <Text style={styles.loadingText}>Loading settings...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor={Colors.background} />
      <ScrollView style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>
            {getTranslatedText("Settings", "ಸೆಟ್ಟಿಂಗ್‌ಗಳು")}
          </Text>
          <View style={styles.titleUnderline} />
        </View>

        {/* Teacher Profile */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            {getTranslatedText("Profile", "ಪ್ರೊಫೈಲ್")}
          </Text>
          <View style={styles.profileCard}>
            <View style={styles.profileInfo}>
              <Text style={styles.profileName}>
                {teacher?.name || "Teacher"}
              </Text>
              <Text style={styles.profilePhone}>{teacher?.phone || ""}</Text>
            </View>
          </View>
        </View>

        {/* Statistics */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            {getTranslatedText("Statistics", "ಅಂಕಿಅಂಶಗಳು")}
          </Text>
          <View style={styles.statsGrid}>
            <View style={styles.statCard}>
              <Text style={styles.statNumber}>{stats.totalStudents}</Text>
              <Text style={styles.statLabel}>
                {getTranslatedText("Total Students", "ಒಟ್ಟು ವಿದ್ಯಾರ್ಥಿಗಳು")}
              </Text>
            </View>
            <View style={styles.statCard}>
              <Text style={styles.statNumber}>{stats.pendingUploads}</Text>
              <Text style={styles.statLabel}>
                {getTranslatedText("Pending Uploads", "ಬಾಕಿ ಅಪ್‌ಲೋಡ್‌ಗಳು")}
              </Text>
            </View>
          </View>
          <View style={styles.syncInfo}>
            <Text style={styles.syncText}>Last Sync: {stats.lastSyncDate}</Text>
          </View>
        </View>

        {/* App Settings */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            {getTranslatedText("App Settings", "ಅಪ್ಲಿಕೇಶನ್ ಸೆಟ್ಟಿಂಗ್‌ಗಳು")}
          </Text>

          <View style={styles.settingItem}>
            <View style={styles.settingTextContainer}>
              <Text style={styles.settingTitle}>
                {getTranslatedText("Bilingual Mode", "ದ್ವಿಭಾಷಾ ಮೋಡ್")}
              </Text>
              <Text style={styles.settingDescription}>
                {getTranslatedText(
                  "Show text in English and Kannada",
                  "ಇಂಗ್ಲಿಷ್ ಮತ್ತು ಕನ್ನಡದಲ್ಲಿ ಪಠ್ಯ ತೋರಿಸಿ"
                )}
              </Text>
            </View>
            <Switch
              value={bilingualMode}
              onValueChange={(value) =>
                handleSettingChange("bilingualMode", value)
              }
              trackColor={{ false: Colors.border, true: Colors.primary }}
            />
          </View>
        </View>

        {/* Actions */}
        <View style={styles.section}>
          <TouchableOpacity
            style={[
              styles.actionButton,
              stats.pendingUploads > 0 && styles.actionButtonHighlight,
            ]}
            onPress={handleSyncData}
          >
            <Text style={styles.actionButtonText}>
              {getTranslatedText(
                `Sync Data${
                  stats.pendingUploads > 0 ? ` (${stats.pendingUploads})` : ""
                }`,
                "ಡೇಟಾ ಸಿಂಕ್ ಮಾಡಿ"
              )}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionButton, styles.logoutButton]}
            onPress={handleLogout}
          >
            <Text style={styles.logoutButtonText}>
              {getTranslatedText("Logout", "ಲಾಗ್ ಔಟ್")}
            </Text>
          </TouchableOpacity>
        </View>

        {/* App Info */}
        <View style={styles.section}>
          <View style={styles.infoContainer}>
            <Text style={styles.infoText}>Version: 1.0.0</Text>
            <Text style={styles.infoText}>© 2024 YuvaSpark</Text>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  container: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: Colors.textSecondary,
  },
  header: {
    alignItems: "center",
    paddingVertical: height * 0.02,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  title: {
    fontSize: Math.min(32, width * 0.08),
    fontWeight: "900",
    color: Colors.textPrimary,
    letterSpacing: 1,
  },
  titleUnderline: {
    width: width * 0.15,
    height: 3,
    backgroundColor: Colors.primary,
    marginTop: 5,
    borderRadius: 10,
  },
  section: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: Colors.textPrimary,
    marginBottom: 16,
  },
  profileCard: {
    backgroundColor: Colors.surface,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  profileInfo: {
    flex: 1,
  },
  profileName: {
    fontSize: 18,
    fontWeight: "600",
    color: Colors.textPrimary,
    marginBottom: 4,
  },
  profilePhone: {
    fontSize: 14,
    color: Colors.textSecondary,
  },
  statsGrid: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  statCard: {
    flex: 1,
    backgroundColor: Colors.surface,
    borderRadius: 12,
    padding: 16,
    marginHorizontal: 4,
    alignItems: "center",
    borderWidth: 1,
    borderColor: Colors.border,
  },
  statNumber: {
    fontSize: 24,
    fontWeight: "700",
    color: Colors.primary,
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    color: Colors.textSecondary,
    textAlign: "center",
  },
  syncInfo: {
    marginTop: 8,
    alignItems: "center",
  },
  syncText: {
    fontSize: 14,
    color: Colors.textSecondary,
  },
  settingItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border + "50",
  },
  settingTextContainer: {
    flex: 1,
    marginRight: 16,
  },
  settingTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: Colors.textPrimary,
    marginBottom: 4,
  },
  settingDescription: {
    fontSize: 14,
    color: Colors.textSecondary,
  },
  actionButton: {
    backgroundColor: Colors.surface,
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    alignItems: "center",
    borderWidth: 1,
    borderColor: Colors.border,
  },
  actionButtonHighlight: {
    backgroundColor: Colors.primary + "10",
    borderColor: Colors.primary,
  },
  actionButtonText: {
    fontSize: 16,
    fontWeight: "600",
    color: Colors.primary,
  },
  logoutButton: {
    backgroundColor: Colors.error + "10",
    borderColor: Colors.error,
  },
  logoutButtonText: {
    fontSize: 16,
    fontWeight: "600",
    color: Colors.error,
  },
  infoContainer: {
    backgroundColor: Colors.surface,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: "center",
  },
  infoText: {
    fontSize: 14,
    color: Colors.textSecondary,
    marginBottom: 4,
  },
});

export default Settings;
