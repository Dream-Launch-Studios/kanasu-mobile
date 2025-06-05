import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
  StatusBar,
  SafeAreaView,
  ScrollView,
  ActivityIndicator,
  RefreshControl,
} from "react-native";
import { router } from "expo-router";
import Colors from "@/constants/Colors";
import axios from "axios";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { API_URL } from "@/constants/api";
const { width, height } = Dimensions.get("window");

// Define types for the API response data
interface Student {
  id: string;
  name: string;
  gender: "MALE" | "FEMALE" | "OTHER";
  status: "ACTIVE" | "INACTIVE";
}

interface Anganwadi {
  id: string;
  name: string;
  location: string;
  district: string;
  state: string;
  students: Student[];
}

interface Teacher {
  id: string;
  name: string;
  phone: string;
}

const Home = () => {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [teacher, setTeacher] = useState<Teacher | null>(null);
  const [anganwadi, setAnganwadi] = useState<Anganwadi | null>(null);
  const [isOffline, setIsOffline] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);

      // Get stored data
      const storedTeacherData = await AsyncStorage.getItem("teacherData");
      const storedAnganwadiData = await AsyncStorage.getItem("anganwadiData");
      const anganwadiId = await AsyncStorage.getItem("anganwadiId");
      const authToken = await AsyncStorage.getItem("authToken");

      // Load cached data first
      if (storedTeacherData) {
        setTeacher(JSON.parse(storedTeacherData));
      }

      if (storedAnganwadiData) {
        setAnganwadi(JSON.parse(storedAnganwadiData));
        setLoading(false);
      }

      // Then fetch fresh data if we have the anganwadi ID and token
      if (anganwadiId && authToken) {
        try {
          const config = {
            headers: {
              Authorization: `Bearer ${authToken}`,
            },
          };

          const anganwadiUrl = `${API_URL}/anganwadis/${anganwadiId}`;
          const response = await axios.get(anganwadiUrl, config);

          // Update state and cache
          setAnganwadi(response.data);
          await AsyncStorage.setItem(
            "anganwadiData",
            JSON.stringify(response.data)
          );
          setIsOffline(false);
        } catch (apiError: any) {
          console.log("Working in offline mode - using cached data");
          setIsOffline(true);
        }
      } else if (storedAnganwadiData) {
        setIsOffline(true);
      }
    } catch (e) {
      console.error("Error loading data:", e);
      setIsOffline(true);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleRefresh = () => {
    setRefreshing(true);
    loadData();
  };

  const handleLogout = async () => {
    try {
      await AsyncStorage.multiRemove([
        "authToken",
        "anganwadiId",
        "anganwadiData",
        "teacherData",
      ]);
      router.push("/");
    } catch (error) {
      console.error("Error during logout:", error);
      router.push("/");
    }
  };

  if (loading && !anganwadi) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <StatusBar
          barStyle="dark-content"
          backgroundColor={Colors.background}
        />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={Colors.primary} />
          <Text style={styles.loadingText}>Loading your dashboard...</Text>
        </View>
      </SafeAreaView>
    );
  }

  // Calculate student counts
  const studentCount = anganwadi?.students?.length || 0;
  const maleStudents =
    anganwadi?.students?.filter((s) => s.gender === "MALE").length || 0;
  const femaleStudents =
    anganwadi?.students?.filter((s) => s.gender === "FEMALE").length || 0;
  const otherStudents =
    anganwadi?.students?.filter((s) => s.gender === "OTHER").length || 0;

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor={Colors.background} />
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>Kanasu</Text>
          <View style={styles.titleUnderline} />
        </View>

        <ScrollView
          contentContainerStyle={styles.scrollContainer}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              colors={[Colors.primary]}
              tintColor={Colors.primary}
            />
          }
        >
          {/* Teacher Profile Section */}
          <View style={styles.profileCard}>
            <View style={styles.profileImageContainer}>
              <Text style={styles.profileInitial}>
                {teacher?.name?.charAt(0) || "T"}
              </Text>
            </View>
            <View style={styles.profileInfo}>
              <Text style={styles.teacherName}>
                {teacher?.name || "Teacher"}
              </Text>
              <Text style={styles.teacherPhone}>{teacher?.phone || ""}</Text>
            </View>
          </View>

          {/* Anganwadi Information */}
          <View style={styles.anganwadiCard}>
            <View style={styles.anganwadiHeader}>
              <Text style={styles.cardSectionTitle}>Anganwadi Center</Text>
              {refreshing && (
                <ActivityIndicator
                  size="small"
                  color={Colors.primary}
                  style={styles.miniLoader}
                />
              )}
            </View>

            <Text style={styles.anganwadiName}>
              {anganwadi?.name || "Unnamed Center"}
            </Text>
            <Text style={styles.anganwadiLocation}>
              {anganwadi?.location || "Location unavailable"}
              {anganwadi?.district ? `, ${anganwadi.district}` : ""}
            </Text>
            <Text style={styles.anganwadiState}>{anganwadi?.state || ""}</Text>

            {isOffline && (
              <View style={styles.offlineIndicator}>
                <Text style={styles.offlineText}>App is running offline</Text>
              </View>
            )}
          </View>

          {/* Stats Overview */}
          <View style={styles.statsContainer}>
            <View style={styles.statsRow}>
              <View style={[styles.statCard, styles.statCardLeft]}>
                <Text style={styles.statNumber}>{studentCount}</Text>
                <Text style={styles.statLabel}>Total Students</Text>
              </View>

              <View style={[styles.statCard, styles.statCardRight]}>
                <Text style={styles.statNumber}>{maleStudents}</Text>
                <Text style={styles.statLabel}>Boys</Text>
              </View>
            </View>

            <View style={styles.statsRow}>
              <View style={[styles.statCard, styles.statCardLeft]}>
                <Text style={styles.statNumber}>{femaleStudents}</Text>
                <Text style={styles.statLabel}>Girls</Text>
              </View>

              <View style={[styles.statCard, styles.statCardRight]}>
                <Text style={styles.statNumber}>{otherStudents}</Text>
                <Text style={styles.statLabel}>Other</Text>
              </View>
            </View>
          </View>

          <View style={styles.sectionTitle}>
            <Text style={styles.sectionTitleText}>Quick Actions</Text>
          </View>

          {/* Quick Action Items */}
          <View style={styles.dashboardGrid}>
            <TouchableOpacity
              style={styles.dashboardItem}
              onPress={() => router.push("/Screens/assessments")}
            >
              <View
                style={[
                  styles.iconContainer,
                  { backgroundColor: Colors.primary + "20" },
                ]}
              >
                <Text style={styles.iconText}>📊</Text>
              </View>
              <Text style={styles.itemTitle}>Assessments</Text>
              <Text style={styles.itemTitleKannada}>ಮೌಲ್ಯಮಾಪನಗಳು</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.dashboardItem}
              onPress={() => router.push("/Screens/students")}
            >
              <View
                style={[
                  styles.iconContainer,
                  { backgroundColor: Colors.mintGreen + "20" },
                ]}
              >
                <Text style={styles.iconText}>👥</Text>
              </View>
              <Text style={styles.itemTitle}>Students</Text>
              <Text style={styles.itemTitleKannada}>ವಿದ್ಯಾರ್ಥಿಗಳು</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.dashboardItem}
              onPress={() => router.push("/Screens/pendingUploads")}
            >
              <View
                style={[
                  styles.iconContainer,
                  { backgroundColor: Colors.warning + "20" },
                ]}
              >
                <Text style={styles.iconText}>📤</Text>
              </View>
              <Text style={styles.itemTitle}>Pending Uploads</Text>
              <Text style={styles.itemTitleKannada}>ಬಾಕಿ ಅಪ್‌ಲೋಡ್‌ಗಳು</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.dashboardItem}
              onPress={() => router.push("/Screens/settings")}
            >
              <View
                style={[
                  styles.iconContainer,
                  { backgroundColor: Colors.secondary + "20" },
                ]}
              >
                <Text style={styles.iconText}>⚙️</Text>
              </View>
              <Text style={styles.itemTitle}>Settings</Text>
              <Text style={styles.itemTitleKannada}>ಸೆಟ್ಟಿಂಗ್‌ಗಳು</Text>
            </TouchableOpacity>
          </View>

          {/* Recent Students */}
          {anganwadi?.students && anganwadi.students.length > 0 && (
            <>
              <View style={styles.sectionTitle}>
                <Text style={styles.sectionTitleText}>Recent Students</Text>
              </View>

              <View style={styles.studentsList}>
                {anganwadi.students.slice(0, 5).map((student) => (
                  <TouchableOpacity key={student.id} style={styles.studentItem}>
                    <View style={styles.studentInitialContainer}>
                      <Text style={styles.studentInitial}>
                        {student.name.charAt(0)}
                      </Text>
                    </View>
                    <View style={styles.studentInfo}>
                      <Text style={styles.studentName}>{student.name}</Text>
                      <Text style={styles.studentGender}>
                        {student.gender === "MALE"
                          ? "Boy"
                          : student.gender === "FEMALE"
                          ? "Girl"
                          : "Other"}
                        {student.status === "ACTIVE"
                          ? " (Active)"
                          : " (Inactive)"}
                      </Text>
                    </View>
                    <Text style={styles.studentArrow}>›</Text>
                  </TouchableOpacity>
                ))}

                {studentCount > 5 && (
                  <TouchableOpacity
                    style={styles.viewAllButton}
                    onPress={() => router.push("/Screens/students")}
                  >
                    <Text style={styles.viewAllText}>
                      View All Students | ಎಲ್ಲಾ ವಿದ್ಯಾರ್ಥಿಗಳನ್ನು ವೀಕ್ಷಿಸಿ
                    </Text>
                  </TouchableOpacity>
                )}
              </View>
            </>
          )}

          <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
            <Text style={styles.logoutText}>Logout | ಲಾಗ್‌ಔಟ್</Text>
          </TouchableOpacity>
        </ScrollView>
      </View>
    </SafeAreaView>
  );
};

export default Home;

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  container: {
    flex: 1,
    backgroundColor: Colors.background,
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
  errorText: {
    fontSize: 14,
    color: Colors.error,
    marginTop: 8,
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
  scrollContainer: {
    paddingHorizontal: width * 0.05,
    paddingBottom: height * 0.05,
  },
  profileCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Colors.surface,
    borderRadius: 16,
    padding: 15,
    marginTop: 20,
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  profileImageContainer: {
    width: 55,
    height: 55,
    borderRadius: 28,
    backgroundColor: Colors.primary,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 15,
  },
  profileInitial: {
    fontSize: 22,
    fontWeight: "bold",
    color: "white",
  },
  profileInfo: {
    flex: 1,
  },
  teacherName: {
    fontSize: 18,
    fontWeight: "700",
    color: Colors.textPrimary,
    marginBottom: 4,
  },
  teacherPhone: {
    fontSize: 14,
    color: Colors.textSecondary,
  },
  anganwadiCard: {
    backgroundColor: Colors.surface,
    borderRadius: 16,
    padding: 15,
    marginTop: 15,
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  anganwadiHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    paddingBottom: 10,
    marginBottom: 10,
  },
  miniLoader: {
    marginLeft: 10,
  },
  cardSectionTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: Colors.textSecondary,
  },
  anganwadiName: {
    fontSize: 18,
    fontWeight: "700",
    color: Colors.textPrimary,
    marginBottom: 4,
  },
  anganwadiLocation: {
    fontSize: 14,
    color: Colors.textSecondary,
    marginBottom: 2,
  },
  anganwadiState: {
    fontSize: 14,
    color: Colors.textSecondary,
  },
  statsContainer: {
    marginTop: 15,
    marginBottom: 5,
  },
  statsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 10,
  },
  statCard: {
    backgroundColor: Colors.surface,
    width: "48%",
    borderRadius: 16,
    padding: 20,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  statCardLeft: {
    marginRight: 5,
  },
  statCardRight: {
    marginLeft: 5,
  },
  statNumber: {
    fontSize: 28,
    fontWeight: "800",
    color: Colors.primary,
    marginBottom: 8,
  },
  statLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: Colors.textSecondary,
    textAlign: "center",
  },
  sectionTitle: {
    marginTop: 25,
    marginBottom: 12,
  },
  sectionTitleText: {
    fontSize: 18,
    fontWeight: "700",
    color: Colors.textPrimary,
  },
  dashboardGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
  },
  dashboardItem: {
    width: "48%",
    backgroundColor: Colors.surface,
    borderRadius: 16,
    padding: 15,
    marginBottom: 12,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.05,
    shadowRadius: 5,
    elevation: 2,
    borderWidth: 1,
    borderColor: Colors.border,
    minHeight: 140,
    justifyContent: "center",
  },
  iconContainer: {
    width: 50,
    height: 50,
    borderRadius: 25,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 10,
  },
  iconText: {
    fontSize: 22,
  },
  itemTitle: {
    fontSize: 15,
    fontWeight: "600",
    color: Colors.textPrimary,
    textAlign: "center",
    marginTop: 8,
  },
  itemTitleKannada: {
    fontSize: 13,
    fontWeight: "500",
    color: Colors.textSecondary,
    textAlign: "center",
    marginTop: 4,
  },
  studentsList: {
    backgroundColor: Colors.surface,
    borderRadius: 16,
    padding: 5,
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.05,
    shadowRadius: 5,
    elevation: 2,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  studentItem: {
    flexDirection: "row",
    alignItems: "center",
    padding: 10,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border + "50",
  },
  studentInitialContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.accent + "20",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 10,
  },
  studentInitial: {
    fontSize: 16,
    fontWeight: "600",
    color: Colors.accent,
  },
  studentInfo: {
    flex: 1,
  },
  studentName: {
    fontSize: 15,
    fontWeight: "600",
    color: Colors.textPrimary,
  },
  studentGender: {
    fontSize: 13,
    color: Colors.textSecondary,
  },
  studentArrow: {
    fontSize: 24,
    color: Colors.textSecondary,
    fontWeight: "bold",
  },
  viewAllButton: {
    padding: 12,
    alignItems: "center",
  },
  viewAllText: {
    fontSize: 14,
    fontWeight: "600",
    color: Colors.primary,
  },
  logoutButton: {
    marginTop: 30,
    backgroundColor: "#f8f9fa",
    padding: 16,
    borderRadius: 12,
    alignItems: "center",
    borderWidth: 1,
    borderColor: Colors.border,
  },
  logoutText: {
    color: Colors.error,
    fontSize: 16,
    fontWeight: "600",
  },
  offlineIndicator: {
    backgroundColor: Colors.warning + "20",
    padding: 8,
    borderRadius: 8,
    marginTop: 10,
    alignItems: "center",
  },
  offlineText: {
    color: Colors.warning,
    fontSize: 14,
    fontWeight: "600",
  },
});
