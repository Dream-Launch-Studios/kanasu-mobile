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
  Alert,
} from "react-native";
import { router } from "expo-router";
import Colors from "@/constants/Colors";
import axios from "axios";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { API_URL } from "@/constants/api";
import { downloadAssessmentMedia } from '../utils/mediaStorage';
import { Ionicons } from "@expo/vector-icons";
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
  isDownloaded?: boolean;
}

const Assessments = () => {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [assessments, setAssessments] = useState<Assessment[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [downloading, setDownloading] = useState<string | null>(null);
  const [downloadingAssessment, setDownloadingAssessment] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'all' | 'downloaded'>('all');
  const [downloadedAssessments, setDownloadedAssessments] = useState<Assessment[]>([]);

  useEffect(() => {
    loadData();
    loadDownloadedAssessments();
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

  const loadDownloadedAssessments = async () => {
    try {
      const downloadedIds = await AsyncStorage.getItem('downloadedAssessments');
      if (downloadedIds) {
        const ids = JSON.parse(downloadedIds);
        const downloaded: Assessment[] = [];
        
        for (const id of ids) {
          const assessmentData = await AsyncStorage.getItem(`assessment_${id}`);
          if (assessmentData) {
            const data = JSON.parse(assessmentData);
            if (data.assessment) {
              downloaded.push({
                ...data.assessment,
                topics: data.topics || [],
                isDownloaded: true
              });
            }
          }
        }
        
        setDownloadedAssessments(downloaded);
      }
    } catch (error) {
      console.error('Error loading downloaded assessments:', error);
    }
  };

  const handleRefresh = () => {
    setRefreshing(true);
    if (activeTab === 'all') {
      loadData();
    } else {
      loadDownloadedAssessments();
    }
    setRefreshing(false);
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString("en-IN", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  };

  // Add function to check if assessment is downloaded
  const checkDownloadStatus = async (assessmentId: string) => {
    try {
      const downloadedAssessments = await AsyncStorage.getItem('downloadedAssessments');
      if (downloadedAssessments) {
        const downloaded = JSON.parse(downloadedAssessments);
        return downloaded.includes(assessmentId);
      }
      return false;
    } catch (error) {
      console.error('Error checking download status:', error);
      return false;
    }
  };

  // Add function to download assessment
  const downloadAssessment = async (assessmentId: string) => {
    try {
      setDownloadingAssessment(assessmentId);
      const anganwadiId = await AsyncStorage.getItem("anganwadiId");
      
      if (!anganwadiId) {
        Alert.alert("Error", "Anganwadi ID not found");
        return;
      }

      // Download assessment data
      console.log("[Debug] Downloading assessment:", assessmentId);
      const response = await axios.get(
        `${API_URL}/global-assessments/${assessmentId}/download?anganwadiId=${anganwadiId}`
      );

      if (!response.data) {
        throw new Error("No data received");
      }

      // Store assessment data
      await AsyncStorage.setItem(
        `assessment_${assessmentId}`,
        JSON.stringify(response.data)
      );

      // Update downloaded assessments list
      const downloadedIds = await AsyncStorage.getItem('downloadedAssessments');
      const ids = downloadedIds ? JSON.parse(downloadedIds) : [];
      if (!ids.includes(assessmentId)) {
        ids.push(assessmentId);
        await AsyncStorage.setItem('downloadedAssessments', JSON.stringify(ids));
      }

      // Download media files
      const mediaFiles = [
        ...response.data.mediaFiles.images,
        ...response.data.mediaFiles.audio
      ];
      
      await downloadAssessmentMedia(assessmentId, mediaFiles);

      // Update both assessment lists
      setAssessments(prevAssessments => 
        prevAssessments.map(assessment => 
          assessment.id === assessmentId 
            ? { ...assessment, isDownloaded: true }
            : assessment
        )
      );

      // Add to downloaded assessments
      const downloadedAssessment = {
        ...response.data.assessment,
        topics: response.data.topics || [],
        isDownloaded: true
      };
      setDownloadedAssessments(prev => [...prev, downloadedAssessment]);

      Alert.alert(
        "Success",
        "Assessment downloaded successfully for offline use",
        [{ text: "OK" }]
      );
    } catch (error) {
      console.error("Download error:", error);
      Alert.alert(
        "Download Failed",
        "Failed to download assessment. Please try again."
      );
    } finally {
      setDownloadingAssessment(null);
    }
  };

  const deleteDownloadedAssessment = async (assessmentId: string) => {
    try {
      // Show confirmation alert
      Alert.alert(
        "Delete Downloaded Assessment",
        "Are you sure you want to delete this downloaded assessment? You'll need to download it again to use it offline.",
        [
          {
            text: "Cancel",
            style: "cancel"
          },
          {
            text: "Delete",
            style: "destructive",
            onPress: async () => {
              // Remove from downloadedAssessments list in AsyncStorage
              const downloadedIds = await AsyncStorage.getItem('downloadedAssessments');
              if (downloadedIds) {
                const ids = JSON.parse(downloadedIds);
                const updatedIds = ids.filter((id: string) => id !== assessmentId);
                await AsyncStorage.setItem('downloadedAssessments', JSON.stringify(updatedIds));
              }

              // Remove assessment data
              await AsyncStorage.removeItem(`assessment_${assessmentId}`);

              // Update UI state
              setDownloadedAssessments(prev => 
                prev.filter(assessment => assessment.id !== assessmentId)
              );
              
              // Update isDownloaded status in all assessments list
              setAssessments(prev =>
                prev.map(assessment =>
                  assessment.id === assessmentId
                    ? { ...assessment, isDownloaded: false }
                    : assessment
                )
              );

              // Show success message
              Alert.alert("Success", "Assessment removed from downloads");
            }
          }
        ]
      );
    } catch (error) {
      console.error('Error deleting assessment:', error);
      Alert.alert("Error", "Failed to delete assessment");
    }
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

          <View style={styles.headerRight}>
            {activeTab === 'downloaded' && (
              <TouchableOpacity
                style={styles.deleteButton}
                onPress={() => deleteDownloadedAssessment(item.id)}
              >
                <Ionicons name="trash-outline" size={20} color={Colors.error} />
              </TouchableOpacity>
            )}
            <View style={[styles.statusBadge, item.isDownloaded && styles.downloadedBadge]}>
              <Text style={[styles.statusText, item.isDownloaded && styles.downloadedText]}>
                {item.isDownloaded ? 'Downloaded' : 'Active'}
              </Text>
            </View>
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

        <View style={styles.buttonContainer}>
          {activeTab === 'all' && !item.isDownloaded ? (
            <TouchableOpacity
              style={[
                styles.actionButton,
                styles.downloadButton,
                downloadingAssessment === item.id && styles.downloadingButton
              ]}
              onPress={() => downloadAssessment(item.id)}
              disabled={downloadingAssessment === item.id}
            >
              {downloadingAssessment === item.id ? (
                <ActivityIndicator color="#FFFFFF" size="small" />
              ) : (
                <Text style={styles.actionButtonText}>Download for Offline Use</Text>
              )}
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={[styles.actionButton, styles.startButton]}
              onPress={() => router.push(`/Screens/takeAssessment?id=${item.id}`)}
            >
              <Text style={styles.actionButtonText}>
                Start Assessment | ಮೌಲ್ಯಮಾಪನ ಪ್ರಾರಂಭಿಸಿ
              </Text>
            </TouchableOpacity>
          )}
        </View>
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
            onPress={() => router.push("/Screens/home")}
          >
            <Text style={styles.backButtonText}>←</Text>
          </TouchableOpacity>
          <Text style={styles.title}>Assessments</Text>
        </View>

        <View style={styles.tabContainer}>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'all' && styles.activeTab]}
            onPress={() => setActiveTab('all')}
          >
            <Text style={[styles.tabText, activeTab === 'all' && styles.activeTabText]}>
              All Assessments
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'downloaded' && styles.activeTab]}
            onPress={() => setActiveTab('downloaded')}
          >
            <Text style={[styles.tabText, activeTab === 'downloaded' && styles.activeTabText]}>
              Downloaded
            </Text>
          </TouchableOpacity>
        </View>

        {error && (
          <View style={styles.errorContainer}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}

        {loading && activeTab === 'all' ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={Colors.primary} />
            <Text style={styles.loadingText}>Loading assessments...</Text>
          </View>
        ) : (
          <FlatList
            data={activeTab === 'all' ? assessments : downloadedAssessments}
            renderItem={renderItem}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.listContainer}
            showsVerticalScrollIndicator={false}
            ListEmptyComponent={
              <View style={styles.emptyContainer}>
                <Text style={styles.emptyText}>
                  {activeTab === 'all'
                    ? "No active assessments available"
                    : "No downloaded assessments"}
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
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  deleteButton: {
    padding: 8,
    borderRadius: 20,
    backgroundColor: Colors.error + '10',
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
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 12,
    gap: 8,
  },
  actionButton: {
    flex: 1,
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  downloadButton: {
    backgroundColor: Colors.primary,
    padding: 10,
    borderRadius: 8,
    marginTop: 10,
  },
  downloadingButton: {
    backgroundColor: Colors.primary + '80',
  },
  downloadButtonText: {
    color: '#FFFFFF',
    textAlign: 'center',
    fontWeight: '600',
  },
  startButton: {
    backgroundColor: Colors.primary,
  },
  actionButtonText: {
    color: Colors.white,
    fontSize: 14,
    fontWeight: '600',
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
  tabContainer: {
    flexDirection: 'row',
    paddingHorizontal: width * 0.05,
    marginVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  tab: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
  },
  activeTab: {
    borderBottomWidth: 2,
    borderBottomColor: Colors.primary,
  },
  tabText: {
    fontSize: 14,
    color: Colors.textSecondary,
    fontWeight: '500',
  },
  activeTabText: {
    color: Colors.primary,
    fontWeight: '600',
  },
  downloadedBadge: {
    backgroundColor: Colors.primary + "20",
  },
  downloadedText: {
    color: Colors.primary,
  },
});
