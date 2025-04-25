import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  Dimensions,
  StatusBar,
  SafeAreaView,
  ActivityIndicator,
  TextInput,
  RefreshControl,
} from "react-native";
import { router } from "expo-router";
import Colors from "@/constants/Colors";
import axios from "axios";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { API_URL } from "@/constants/api";
const { width, height } = Dimensions.get("window");

// Define type for Student
interface Student {
  id: string;
  name: string;
  gender: "MALE" | "FEMALE";
  status: "ACTIVE" | "INACTIVE";
  dob?: string;
  age?: number;
}

const Students = () => {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [students, setStudents] = useState<Student[]>([]);
  const [filteredStudents, setFilteredStudents] = useState<Student[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (searchQuery.trim() === "") {
      setFilteredStudents(students);
    } else {
      const filtered = students.filter((student) =>
        student.name.toLowerCase().includes(searchQuery.toLowerCase())
      );
      setFilteredStudents(filtered);
    }
  }, [searchQuery, students]);

  const loadData = async () => {
    try {
      setLoading(true);

      // Get stored data
      const anganwadiData = await AsyncStorage.getItem("anganwadiData");
      const anganwadiId = await AsyncStorage.getItem("anganwadiId");
      const authToken = await AsyncStorage.getItem("authToken");

      console.log("Retrieved anganwadi ID:", anganwadiId);

      // Check if we have cached data
      if (anganwadiData) {
        const data = JSON.parse(anganwadiData);
        if (data.students && Array.isArray(data.students)) {
          setStudents(data.students);
          setFilteredStudents(data.students);
          setLoading(false);
        }
      }

      // Fetch fresh data if we have the token
      if (anganwadiId && authToken) {
        try {
          console.log("Fetching anganwadi data from API...");

          const config = {
            headers: {
              Authorization: `Bearer ${authToken}`,
            },
          };

          // Use the proper endpoint
          const anganwadiUrl = `${API_URL}/anganwadis/${anganwadiId}`;
          console.log("Fetching from:", anganwadiUrl);

          const response = await axios.get(anganwadiUrl, config);

          if (response.data.students && Array.isArray(response.data.students)) {
            setStudents(response.data.students);
            setFilteredStudents(response.data.students);
            setError(null);
            console.log("Students data:", response.data.students);
          } else {
            console.log("Invalid student data format in API response");
            if (!students.length) {
              setError("No student data available");
            }
          }
        } catch (apiError: any) {
          console.error("Error fetching anganwadi data:", apiError.message);
          console.log("Status:", apiError.response?.status);
          console.log("Error details:", apiError.response?.data);

          if (!students.length) {
            setError("Could not fetch student data");
          }
        }
      } else {
        if (!students.length) {
          setError("No student information available. Please log in again.");
        }
      }
    } catch (e) {
      console.error("Error loading data:", e);
      setError("Failed to load student data");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleRefresh = () => {
    setRefreshing(true);
    loadData();
  };

  const renderItem = ({ item }: { item: Student }) => (
    <TouchableOpacity style={styles.studentCard}>
      <View style={styles.studentInitialContainer}>
        <Text style={styles.studentInitial}>{item.name.charAt(0)}</Text>
      </View>
      <View style={styles.studentInfo}>
        <Text style={styles.studentName}>{item.name}</Text>
        <Text style={styles.studentDetails}>
          {item.gender === "MALE"
            ? "Boy"
            : item.gender === "FEMALE"
            ? "Girl"
            : "Other"}{" "}
          • {item.status === "ACTIVE" ? "Active" : "Inactive"}
        </Text>
      </View>
      <Text style={styles.arrowIcon}>›</Text>
    </TouchableOpacity>
  );

  if (loading && students.length === 0) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <StatusBar
          barStyle="dark-content"
          backgroundColor={Colors.background}
        />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={Colors.primary} />
          <Text style={styles.loadingText}>Loading students...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor={Colors.background} />
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => router.back()}
          >
            <Text style={styles.backButtonText}>←</Text>
          </TouchableOpacity>
          <Text style={styles.title}>Students</Text>
        </View>

        <View style={styles.searchContainer}>
          <TextInput
            style={styles.searchInput}
            placeholder="Search by name..."
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholderTextColor={Colors.textSecondary}
          />
        </View>

        {error && (
          <View style={styles.errorContainer}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}

        <FlatList
          data={filteredStudents}
          renderItem={renderItem}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContainer}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>No students found</Text>
            </View>
          }
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              colors={[Colors.primary]}
              tintColor={Colors.primary}
            />
          }
        />
      </View>
    </SafeAreaView>
  );
};

export default Students;

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
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: height * 0.02,
    paddingHorizontal: width * 0.05,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  backButton: {
    marginRight: 15,
  },
  backButtonText: {
    fontSize: 24,
    fontWeight: "bold",
    color: Colors.primary,
  },
  title: {
    fontSize: 22,
    fontWeight: "700",
    color: Colors.textPrimary,
  },
  searchContainer: {
    paddingHorizontal: width * 0.05,
    paddingVertical: 15,
  },
  searchInput: {
    backgroundColor: Colors.surface,
    borderRadius: 12,
    paddingHorizontal: 15,
    paddingVertical: 12,
    fontSize: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    color: Colors.textPrimary,
  },
  listContainer: {
    paddingHorizontal: width * 0.05,
    paddingBottom: 20,
  },
  studentCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Colors.surface,
    borderRadius: 16,
    padding: 15,
    marginBottom: 10,
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 2,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  studentInitialContainer: {
    width: 45,
    height: 45,
    borderRadius: 23,
    backgroundColor: Colors.accent + "20",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 15,
  },
  studentInitial: {
    fontSize: 18,
    fontWeight: "600",
    color: Colors.accent,
  },
  studentInfo: {
    flex: 1,
  },
  studentName: {
    fontSize: 16,
    fontWeight: "600",
    color: Colors.textPrimary,
    marginBottom: 4,
  },
  studentDetails: {
    fontSize: 14,
    color: Colors.textSecondary,
  },
  arrowIcon: {
    fontSize: 24,
    color: Colors.textSecondary,
    fontWeight: "bold",
  },
  emptyContainer: {
    padding: 30,
    alignItems: "center",
  },
  emptyText: {
    color: Colors.textSecondary,
    fontSize: 16,
  },
  errorContainer: {
    padding: 15,
    margin: 15,
    backgroundColor: Colors.error + "10",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.error + "30",
  },
  errorText: {
    color: Colors.error,
    fontSize: 14,
    textAlign: "center",
  },
});
