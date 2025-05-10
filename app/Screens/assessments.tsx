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
  RefreshControl,
} from "react-native";
import { router } from "expo-router";
import Colors from "@/constants/Colors";
import axios from "axios";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { API_URL } from "@/constants/api";
const { width, height } = Dimensions.get("window");

// Define types for the API response data
interface Question {
  id: string;
  text: string;
  questionType: string;
  options?: any[];
}

interface Topic {
  id: string;
  name: string;
  description: string;
  questions: Question[];
}

interface AnganwadiAssessment {
  id: string;
  anganwadiId: string;
  assessmentId: string;
}

interface Assessment {
  id: string;
  name: string;
  description?: string;
  startDate: string;
  endDate: string;
  isActive: boolean;
  status: string;
  topics: Topic[];
  anganwadiAssessments: AnganwadiAssessment[];
}

const Assessments = () => {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [assessments, setAssessments] = useState<Assessment[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);

      // Get stored data
      const anganwadiId = await AsyncStorage.getItem("anganwadiId");
      const authToken = await AsyncStorage.getItem("authToken");

      console.log("Retrieved anganwadi ID for assessments:", anganwadiId);

      if (anganwadiId && authToken) {
        try {
          console.log("Fetching active assessments...");

          const config = {
            headers: {
              Authorization: `Bearer ${authToken}`,
            },
          };

          // Use the endpoint from the controller
          const assessmentsUrl = `${API_URL}/global-assessments/active?anganwadiId=${anganwadiId}`;
          console.log("Fetching from:", assessmentsUrl);

          const response = await axios.get(assessmentsUrl, config);
          console.log("Assessments fetched successfully");
          console.log("Response data:", response.data);

          // Check if response.data exists and is an array
          if (response.data && Array.isArray(response.data)) {
            console.log("Number of assessments:", response.data.length);
            setAssessments(response.data);
            setError(null);
          } else {
            console.log("Invalid assessment data format:", response.data);
            setError("Unable to load assessments data");
            setAssessments([]); // Clear assessments if data is invalid
          }
        } catch (apiError: any) {
          console.error("Error fetching assessments:", apiError.message);
          console.log("Status:", apiError.response?.status);
          console.log("Error details:", apiError.response?.data);
          setError("Could not fetch assessments");
          setAssessments([]); // Clear assessments on error
        }
      } else {
        console.log("Missing anganwadiId or authToken");
        setError("No anganwadi information available. Please log in again.");
        setAssessments([]); // Clear assessments if no auth
      }
    } catch (e) {
      console.error("Error loading data:", e);
      setError("Failed to load assessments data");
      setAssessments([]); // Clear assessments on general error
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleRefresh = () => {
    setRefreshing(true);
    loadData();
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString("en-IN", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  };

  const renderItem = ({ item }: { item: Assessment }) => {
    const questionCount = item.topics.reduce(
      (count, topic) => count + topic.questions.length,
      0
    );

    return (
      <TouchableOpacity
        style={styles.assessmentCard}
        onPress={() => console.log("Open assessment details", item.id)}
      >
        <View style={styles.assessmentHeader}>
          <Text style={styles.assessmentTitle}>{item.name}</Text>

          <View style={styles.statusBadge}>
            <Text style={styles.statusText}>Active</Text>
          </View>
        </View>

        <Text style={styles.assessmentDescription}>
          {item.description || "No description available"}
        </Text>

        <View style={styles.assessmentMeta}>
          <Text style={styles.assessmentMetaText}>
            {item.topics.length} {item.topics.length === 1 ? "Topic" : "Topics"}
          </Text>
          <Text style={styles.assessmentMetaText}>
            {questionCount} {questionCount === 1 ? "Question" : "Questions"}
          </Text>
        </View>

        <View style={styles.assessmentDates}>
          <Text style={styles.dateLabel}>Available until:</Text>
          <Text style={styles.dateValue}>{formatDate(item.endDate)}</Text>
        </View>

        <TouchableOpacity
          style={styles.startButton}
          onPress={() => router.push(`/Screens/takeAssessment?id=${item.id}`)}
        >
          <Text style={styles.startButtonText}>Start Assessment | ಮೌಲ್ಯಮಾಪನ ಪ್ರಾರಂಭಿಸಿ</Text>
        </TouchableOpacity>
      </TouchableOpacity>
    );
  };

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
          <Text style={styles.title}>Assessments</Text>
        </View>

        {error && (
          <View style={styles.errorContainer}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}

        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={Colors.primary} />
            <Text style={styles.loadingText}>Loading assessments...</Text>
          </View>
        ) : (
          <FlatList
            data={assessments}
            renderItem={renderItem}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.listContainer}
            showsVerticalScrollIndicator={false}
            ListEmptyComponent={
              <View style={styles.emptyContainer}>
                <Text style={styles.emptyText}>
                  {error
                    ? "Error loading assessments"
                    : "No active assessments available"}
                </Text>
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
        )}
      </View>
    </SafeAreaView>
  );
};

export default Assessments;

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
  listContainer: {
    padding: width * 0.05,
    paddingBottom: 20,
  },
  assessmentCard: {
    backgroundColor: Colors.surface,
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
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
  assessmentHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  assessmentTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: Colors.textPrimary,
    flex: 1,
  },
  statusBadge: {
    backgroundColor: Colors.primary + "20",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    color: Colors.primary,
    fontSize: 12,
    fontWeight: "600",
  },
  assessmentDescription: {
    fontSize: 14,
    color: Colors.textSecondary,
    marginBottom: 12,
  },
  assessmentMeta: {
    flexDirection: "row",
    marginBottom: 12,
  },
  assessmentMetaText: {
    fontSize: 14,
    color: Colors.textSecondary,
    marginRight: 16,
  },
  assessmentDates: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 16,
  },
  dateLabel: {
    fontSize: 14,
    color: Colors.textSecondary,
    marginRight: 6,
  },
  dateValue: {
    fontSize: 14,
    fontWeight: "600",
    color: Colors.textPrimary,
  },
  startButton: {
    backgroundColor: Colors.primary,
    borderRadius: 12,
    padding: 14,
    alignItems: "center",
  },
  startButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "600",
  },
  emptyContainer: {
    padding: 30,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyText: {
    color: Colors.textSecondary,
    fontSize: 16,
    textAlign: "center",
  },
  errorContainer: {
    margin: 15,
    padding: 15,
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
