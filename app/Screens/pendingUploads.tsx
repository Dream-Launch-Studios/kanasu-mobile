import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
} from "react-native";
import { router } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import axios from "axios";
import { API_URL } from "@/constants/api";
import Colors from "@/constants/Colors";
import { Audio } from "expo-av";
import { clearAllStorage } from "../utils/clearStorage";

interface PendingResponse {
  studentId: string;
  studentName: string;
  assessmentId: string;
  assessmentName: string;
  audioUri: string;
  metadata: any;
  timestamps: any[];
  recordedAt: string;
  status: "pending" | "uploaded";
  error?: string;
}

const PendingUploads = () => {
  const [pendingResponses, setPendingResponses] = useState<PendingResponse[]>(
    []
  );
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    loadPendingResponses();
  }, []);

  const loadPendingResponses = async () => {
    try {
      const responses = await AsyncStorage.getItem("pendingResponses");
      if (responses) {
        const parsedResponses = JSON.parse(responses);
        // Ensure all responses have valid status
        const validatedResponses = parsedResponses.map((response: any) => ({
          ...response,
          status: response.status === "uploaded" ? "uploaded" : "pending",
        }));
        setPendingResponses(validatedResponses);
      }
    } catch (error) {
      console.error("Error loading pending responses:", error);
      Alert.alert("Error", "Failed to load pending responses");
    } finally {
      setLoading(false);
    }
  };

  const clearPendingResponses = async () => {
    try {
      await clearAllStorage();
      setPendingResponses([]);
      Alert.alert("Success", "All storage has been cleared");
    } catch (error) {
      console.error("Error clearing pending responses:", error);
      Alert.alert("Error", "Failed to clear storage");
    }
  };

  const uploadResponse = async (response: PendingResponse) => {
    let uploadError: string | null = null;
    try {
      // Validate response data
      if (!response.audioUri || !response.timestamps || response.timestamps.length === 0) {
        throw new Error("Invalid response data");
      }

      const authToken = await AsyncStorage.getItem("authToken");
      if (!authToken) {
        throw new Error("Authentication token not found");
      }

      let audioUrl = null;
      let metadataUrl = null;

      // Upload audio file
      try {
        audioUrl = await uploadAudio(response.audioUri);
      } catch (error) {
        console.error("Failed to upload audio:", error);
        uploadError = "Failed to upload audio file";
        throw error;
      }

      // Update metadata with audio URL
      const metadata = { ...response.metadata, audioUrl };

      // Upload metadata
      try {
        metadataUrl = await uploadMetadata(metadata);
      } catch (error) {
        console.error("Failed to upload metadata:", error);
        uploadError = "Failed to upload metadata";
        throw error;
      }

      // Create response entries
      const responses = response.timestamps.map((timestamp) => ({
        questionId: timestamp.questionId,
        startTime: new Date(timestamp.startTime).toISOString(),
        endTime: new Date(timestamp.endTime).toISOString(),
        audioUrl,
        metadataUrl,
        startTimeSeconds: Math.floor(timestamp.startTime / 1000),
        endTimeSeconds: Math.floor(timestamp.endTime / 1000),
        durationSeconds: Math.floor(
          (timestamp.endTime - timestamp.startTime) / 1000
        ),
      }));

      // Submit to backend
      try {
        await axios.post(
          `${API_URL}/student-responses/audio-assessment`,
          {
            assessmentId: response.assessmentId,
            studentId: response.studentId,
            responses,
            audioUrl,
            metadataUrl,
            timestamps: response.timestamps,
          },
          {
            headers: { Authorization: `Bearer ${authToken}` },
            timeout: 30000, // 30 second timeout
          }
        );

        // Update the state to mark this response as uploaded
        const updatedResponses = pendingResponses.map((r) =>
          r.studentId === response.studentId && r.assessmentId === response.assessmentId
            ? { ...r, status: "uploaded" as const }
            : r
        );
        
        // Save to AsyncStorage
        await AsyncStorage.setItem("pendingResponses", JSON.stringify(updatedResponses));
        setPendingResponses(updatedResponses);

        Alert.alert("Success", "Response uploaded successfully");
      } catch (error) {
        console.error("Failed to submit to backend:", error);
        uploadError = "Failed to submit response to server";
        throw error;
      }
    } catch (error) {
      console.error("Error uploading response:", error);
      Alert.alert(
        "Upload Failed",
        uploadError || "Failed to upload response. Please try again."
      );
      // Update the status of the failed response
      const updatedResponses = pendingResponses.map((r) =>
        r.studentId === response.studentId && r.assessmentId === response.assessmentId
          ? { ...r, status: "pending" as const, error: uploadError || undefined }
          : r
      );
      await AsyncStorage.setItem("pendingResponses", JSON.stringify(updatedResponses));
      setPendingResponses(updatedResponses);
    }
  };

  const uploadAllResponses = async () => {
    try {
      setUploading(true);
      const pending = pendingResponses.filter((r) => r.status === "pending");
      const total = pending.length;
      let completed = 0;

      for (const response of pending) {
        try {
          await uploadResponse(response);
          completed++;
          // Update progress if needed
          if (total > 1) {
            Alert.alert(
              "Progress",
              `Uploaded ${completed} of ${total} responses`
            );
          }
        } catch (error) {
          console.error(
            `Failed to upload response for ${response.studentName}:`,
            error
          );
          // Continue with next response even if one fails
        }
      }

      if (completed === total) {
        Alert.alert("Success", "All responses uploaded successfully");
      } else {
        Alert.alert(
          "Partial Success",
          `Uploaded ${completed} of ${total} responses. Some uploads failed.`
        );
      }
    } catch (error) {
      console.error("Error in uploadAllResponses:", error);
      Alert.alert("Error", "Failed to upload some responses");
    } finally {
      setUploading(false);
    }
  };

  const uploadAudio = async (uri: string) => {
    const authToken = await AsyncStorage.getItem("authToken");
    if (!authToken) throw new Error("Authentication token not found");

    const formData = new FormData();
    formData.append("file", {
      uri: uri,
      type: "audio/aac",
      name: `recording_${Date.now()}.acc`,
    } as any);

    const response = await axios.post(
      `${API_URL}/questions/upload-audio`,
      formData,
      {
        headers: {
          "Content-Type": "multipart/form-data",
          Authorization: `Bearer ${authToken}`,
        },
      }
    );

    return (
      response.data.audioUrl ||
      response.data.secure_url ||
      response.data.fileUrl
    );
  };

  const uploadMetadata = async (metadata: any) => {
    const authToken = await AsyncStorage.getItem("authToken");
    if (!authToken) throw new Error("Authentication token not found");

    const response = await axios.post(
      `${API_URL}/student-responses/upload-metadata`,
      { metadata },
      {
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${authToken}`,
        },
      }
    );

    return response.data.metadataUrl;
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.backButton}>←</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Pending Uploads</Text>
      </View>

      <TouchableOpacity
        style={styles.clearAllButton}
        onPress={clearPendingResponses}
      >
        <Text style={styles.clearAllButtonText}>Clear All</Text>
      </TouchableOpacity>

      {pendingResponses.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>No pending uploads</Text>
        </View>
      ) : (
        <>
          <TouchableOpacity
            style={styles.uploadAllButton}
            onPress={uploadAllResponses}
            disabled={uploading}
          >
            {uploading ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={styles.uploadAllButtonText}>Upload All</Text>
            )}
          </TouchableOpacity>

          <ScrollView style={styles.listContainer}>
            {pendingResponses.map((response, index) => (
              <View
                key={`${response.studentId}-${response.assessmentId}`}
                style={styles.responseCard}
              >
                <View style={styles.responseHeader}>
                  <Text style={styles.studentName}>{response.studentName}</Text>
                  <Text style={styles.assessmentName}>
                    {response.assessmentName}
                  </Text>
                </View>
                <Text style={styles.recordedAt}>
                  Recorded: {new Date(response.recordedAt).toLocaleString()}
                </Text>
                <View style={styles.statusContainer}>
                  <View
                    style={[
                      styles.statusBadge,
                      {
                        backgroundColor:
                          response.status === "uploaded"
                            ? Colors.success
                            : Colors.warning,
                      },
                    ]}
                  >
                    <Text style={styles.statusText}>
                      {response.status === "uploaded" ? "Uploaded" : "Pending"}
                    </Text>
                  </View>
                  {response.status === "pending" && (
                    <TouchableOpacity
                      style={styles.uploadButton}
                      onPress={() => uploadResponse(response)}
                    >
                      <Text style={styles.uploadButtonText}>Upload</Text>
                    </TouchableOpacity>
                  )}
                </View>
              </View>
            ))}
          </ScrollView>
        </>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  backButton: {
    fontSize: 24,
    marginRight: 16,
    color: Colors.primary,
  },
  title: {
    fontSize: 20,
    fontWeight: "bold",
    color: Colors.textPrimary,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  emptyText: {
    fontSize: 16,
    color: Colors.textSecondary,
  },
  uploadAllButton: {
    backgroundColor: Colors.primary,
    padding: 16,
    margin: 16,
    borderRadius: 12,
    alignItems: "center",
  },
  uploadAllButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "600",
  },
  listContainer: {
    flex: 1,
    padding: 16,
  },
  responseCard: {
    backgroundColor: Colors.surface,
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  responseHeader: {
    marginBottom: 8,
  },
  studentName: {
    fontSize: 18,
    fontWeight: "600",
    color: Colors.textPrimary,
    marginBottom: 4,
  },
  assessmentName: {
    fontSize: 14,
    color: Colors.textSecondary,
  },
  recordedAt: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginBottom: 12,
  },
  statusContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  statusText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "600",
  },
  uploadButton: {
    backgroundColor: Colors.primary,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  uploadButtonText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "600",
  },
  clearAllButton: {
    backgroundColor: "#FF4D4F",
    padding: 16,
    marginHorizontal: 16,
    marginTop: 8,
    borderRadius: 12,
    alignItems: "center",
  },
  clearAllButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "600",
  },
});

export default PendingUploads;
