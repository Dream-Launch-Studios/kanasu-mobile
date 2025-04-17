import React, { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
  StatusBar,
  SafeAreaView,
  ActivityIndicator,
  Alert,
  ScrollView,
  Image,
} from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import Colors from "@/constants/Colors";
import axios from "axios";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Audio } from "expo-av";

const { width, height } = Dimensions.get("window");
const API_BASE_URL = "http://192.168.215.178:3000/api";

interface Question {
  id: string;
  text: string;
  imageUrl?: string;
  questionType: string;
  options?: any[];
}

interface Topic {
  id: string;
  name: string;
  description: string;
  questions: Question[];
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
}

interface Student {
  id: string;
  name: string;
  gender: "MALE" | "FEMALE";
  status: "ACTIVE" | "INACTIVE";
}

interface QuestionTimestamp {
  questionId: string;
  startTime: number; // milliseconds from start of recording
  endTime: number; // milliseconds from start of recording
}

const TakeAssessment = () => {
  const params = useLocalSearchParams();
  const assessmentId = params.id as string;
  const [loading, setLoading] = useState(true);
  const [assessment, setAssessment] = useState<Assessment | null>(null);
  const [students, setStudents] = useState<Student[]>([]);
  const [currentStudent, setCurrentStudent] = useState<Student | null>(null);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [allQuestions, setAllQuestions] = useState<Question[]>([]);
  const [currentQuestion, setCurrentQuestion] = useState<Question | null>(null);

  // Continuous recording state
  const [recording, setRecording] = useState<Audio.Recording | null>(null);
  const [recordingStartTime, setRecordingStartTime] = useState<number>(0);
  const [isRecording, setIsRecording] = useState(false);
  const [audioUri, setAudioUri] = useState<string | null>(null);
  const [questionTimestamps, setQuestionTimestamps] = useState<
    QuestionTimestamp[]
  >([]);

  const [questionCompleted, setQuestionCompleted] = useState<boolean>(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isCompleted, setIsCompleted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Initialize with assessment data and students
  useEffect(() => {
    loadAssessmentAndStudents();
  }, [assessmentId]);

  // Flatten all questions from topics when assessment loads
  useEffect(() => {
    if (assessment) {
      const questions: Question[] = [];
      assessment.topics.forEach((topic) => {
        if (topic.questions) {
          questions.push(...topic.questions);
        }
      });
      setAllQuestions(questions);
      if (questions.length > 0) {
        setCurrentQuestion(questions[0]);
      }
    }
  }, [assessment]);

  // Update current question when index changes
  useEffect(() => {
    if (allQuestions.length > 0 && currentQuestionIndex < allQuestions.length) {
      setCurrentQuestion(allQuestions[currentQuestionIndex]);
      setQuestionCompleted(false);
    }
  }, [currentQuestionIndex, allQuestions]);

  // Load assessment data and students
  const loadAssessmentAndStudents = async () => {
    try {
      setLoading(true);
      const authToken = await AsyncStorage.getItem("authToken");
      const anganwadiId = await AsyncStorage.getItem("anganwadiId");
      const anganwadiData = await AsyncStorage.getItem("anganwadiData");

      if (!assessmentId || !authToken || !anganwadiId) {
        setError("Missing required data");
        setLoading(false);
        return;
      }

      // Load students from cached anganwadi data
      if (anganwadiData) {
        const data = JSON.parse(anganwadiData);
        if (data.students && Array.isArray(data.students)) {
          setStudents(data.students);
        }
      }

      // Fetch assessment details
      try {
        const config = { headers: { Authorization: `Bearer ${authToken}` } };
        const response = await axios.get(
          `${API_BASE_URL}/global-assessments/${assessmentId}`,
          config
        );

        if (response.data) {
          setAssessment(response.data);
          setError(null);
        } else {
          setError("Invalid assessment data");
        }
      } catch (apiError: any) {
        console.error("Error fetching assessment:", apiError);
        setError("Could not fetch assessment details");
      }
    } catch (e) {
      console.error("Error loading data:", e);
      setError("Failed to load assessment data");
    } finally {
      setLoading(false);
    }
  };

  // Select a student to assess
  const selectStudent = (student: Student) => {
    setCurrentStudent(student);
    setCurrentQuestionIndex(0);
    setQuestionTimestamps([]);
    setQuestionCompleted(false);

    // Start recording for this student
    startFullRecording();
  };

  // Start recording for the entire assessment
  const startFullRecording = async () => {
    try {
      // Request permissions
      const permission = await Audio.requestPermissionsAsync();
      if (permission.status !== "granted") {
        Alert.alert(
          "Permission Denied",
          "Please allow microphone access to record responses"
        );
        return;
      }

      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });

      // Create recording
      const newRecording = new Audio.Recording();
      await newRecording.prepareToRecordAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY
      );
      await newRecording.startAsync();

      // Save recording and start time
      setRecording(newRecording);
      setIsRecording(true);
      const startTime = Date.now();
      setRecordingStartTime(startTime);

      console.log("Recording started at:", new Date(startTime).toISOString());
    } catch (error) {
      console.error("Failed to start recording", error);
      Alert.alert("Recording Error", "Failed to start recording");
    }
  };

  // Mark start time for current question
  const markQuestionStart = () => {
    if (!currentQuestion) return;

    // Calculate time from recording start
    const relativeTime = Date.now() - recordingStartTime;

    console.log(`Starting question ${currentQuestion.id} at ${relativeTime}ms`);

    // Add to timestamps array
    setQuestionTimestamps((prev) => [
      ...prev,
      {
        questionId: currentQuestion.id,
        startTime: relativeTime,
        endTime: 0, // Will set this when question ends
      },
    ]);
  };

  // Mark end time for current question
  const markQuestionEnd = () => {
    if (!currentQuestion) return;

    // Calculate time from recording start
    const relativeTime = Date.now() - recordingStartTime;

    console.log(`Ending question ${currentQuestion.id} at ${relativeTime}ms`);

    // Update existing timestamp
    setQuestionTimestamps((prev) =>
      prev.map((item) =>
        item.questionId === currentQuestion.id
          ? { ...item, endTime: relativeTime }
          : item
      )
    );

    setQuestionCompleted(true);
  };

  // Stop the full recording and process it
  const stopFullRecording = async () => {
    if (!recording) {
      console.error("No active recording found");
      return;
    }

    try {
      // Stop recording
      await recording.stopAndUnloadAsync();
      const uri = recording.getURI();
      setAudioUri(uri || null);
      setIsRecording(false);

      console.log("Recording stopped, URI:", uri);

      return uri;
    } catch (error) {
      console.error("Failed to stop recording", error);
      Alert.alert("Recording Error", "Failed to stop recording");
      return null;
    }
  };

  // Upload audio file to server
  const uploadAudio = async (uri: string) => {
    try {
      console.log("Uploading audio file:", uri);

      const authToken = await AsyncStorage.getItem("authToken");
      if (!authToken) {
        throw new Error("Authentication token not found");
      }

      // Create form data for file upload with correct field name
      const formData = new FormData();

      // The backend is expecting "file" field, not "audio"
      formData.append("file", {
        uri: uri,
        type: "audio/m4a",
        name: `recording_${Date.now()}.m4a`,
      } as any);

      console.log("Sending request to upload endpoint with file field...");

      // Additional logging to diagnose issues
      console.log(
        "FormData contents:",
        JSON.stringify({
          fieldName: "file",
          uri: uri.substring(0, 50) + "...", // Show part of the URI for debugging
          type: "audio/m4a",
          name: `recording_${Date.now()}.m4a`,
        })
      );

      // Change to a working endpoint (questions/upload-audio)
      const uploadEndpoint = `${API_BASE_URL}/questions/upload-audio`;
      console.log("Using upload endpoint:", uploadEndpoint);

      // Upload to server
      const response = await axios.post(uploadEndpoint, formData, {
        headers: {
          "Content-Type": "multipart/form-data",
          Authorization: `Bearer ${authToken}`,
        },
        // Add longer timeout for large files
        timeout: 30000, // 30 seconds
      });

      console.log("Audio upload response:", response.data);

      // Handle different possible response formats
      if (response.data) {
        // Different backends might use different field names
        const url =
          response.data.audioUrl ||
          response.data.secure_url ||
          response.data.fileUrl;
        if (url) {
          console.log("Successfully got audio URL:", url);
          return url;
        }
      }

      throw new Error("Invalid response from server: missing audioUrl");
    } catch (error: any) {
      console.error("Failed to upload audio:", error.message);
      if (error.response) {
        console.error("Response status:", error.response.status);
        console.error("Response data:", JSON.stringify(error.response.data));
      }
      throw error;
    }
  };

  // Create metadata JSON for the audio recording
  const createAudioMetadata = () => {
    if (!currentStudent || !assessment) {
      return null;
    }

    // Format timestamps as mm:ss format for better readability
    const formatTime = (milliseconds: number) => {
      const totalSeconds = Math.floor(milliseconds / 1000);
      const minutes = Math.floor(totalSeconds / 60);
      const seconds = totalSeconds % 60;
      return `${minutes.toString().padStart(2, "0")}:${seconds
        .toString()
        .padStart(2, "0")}`;
    };

    // Create response segments with formatted timestamps and question info
    const segments = questionTimestamps.map((timestamp, index) => {
      // Find the question text using the ID
      const question = allQuestions.find((q) => q.id === timestamp.questionId);

      // Find which topic this question belongs to for better context
      let topicName = "Unknown Topic";
      if (assessment && assessment.topics) {
        for (const topic of assessment.topics) {
          if (
            topic.questions &&
            topic.questions.some((q) => q.id === timestamp.questionId)
          ) {
            topicName = topic.name;
            break;
          }
        }
      }

      return {
        index: index + 1,
        questionId: timestamp.questionId,
        questionText: question?.text || "Unknown question",
        topicName: topicName,
        questionType: question?.questionType || "SPEAKING",
        startTimeMs: timestamp.startTime,
        endTimeMs: timestamp.endTime,
        durationMs: timestamp.endTime - timestamp.startTime,
        startTimeFormatted: formatTime(timestamp.startTime),
        endTimeFormatted: formatTime(timestamp.endTime),
        durationFormatted: formatTime(timestamp.endTime - timestamp.startTime),
      };
    });

    // Add a formatted timestamp for the recording date
    const recordedDate = new Date();
    const formattedDate = recordedDate.toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });

    // Create the metadata object with optional audioUrl field
    return {
      recordingId: `${currentStudent.id}_${Date.now()}`,
      studentId: currentStudent.id,
      studentName: currentStudent.name,
      assessmentId: assessment.id,
      assessmentName: assessment.name,
      totalDurationMs:
        questionTimestamps.length > 0
          ? Math.max(...questionTimestamps.map((t) => t.endTime))
          : 0,
      totalDurationFormatted: formatTime(
        questionTimestamps.length > 0
          ? Math.max(...questionTimestamps.map((t) => t.endTime))
          : 0
      ),
      recordedAt: recordedDate.toISOString(),
      recordedAtFormatted: formattedDate,
      segments: segments,
      totalSegments: segments.length,
      audioUrl: "", // Initialize with empty string, will be updated later
    };
  };

  // Upload metadata JSON to server
  const uploadMetadata = async (metadata: any) => {
    try {
      console.log("Preparing to upload metadata to server");

      const authToken = await AsyncStorage.getItem("authToken");
      if (!authToken) {
        throw new Error("Authentication token not found");
      }

      // Make a deep copy to avoid modifying the original object
      const metadataCopy = JSON.parse(JSON.stringify(metadata));

      // Ensure metadata has all required fields
      if (
        !metadataCopy.recordingId ||
        !metadataCopy.studentId ||
        !metadataCopy.segments
      ) {
        console.error("Metadata missing required fields");
        return null;
      }

      console.log(
        `Uploading metadata with ${metadataCopy.segments.length} segments`
      );

      // First attempt - try regular upload endpoint
      try {
        const response = await axios.post(
          `${API_BASE_URL}/student-responses/upload-metadata`,
          { metadata: metadataCopy },
          {
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${authToken}`,
            },
            timeout: 10000, // 10 second timeout
          }
        );

        console.log("Metadata upload successful:", response.status);
        console.log(
          "Metadata upload response data:",
          JSON.stringify(response.data, null, 2)
        );

        if (response.data && response.data.metadataUrl) {
          return response.data.metadataUrl;
        }

        console.warn("No metadata URL in response:", response.data);
      } catch (error: any) {
        console.error("Primary metadata upload failed:", error.message);
        // Continue to fallback method
      }

      // Fallback approach - try backup endpoint if available
      try {
        console.log("Attempting fallback metadata upload");
        const fallbackResponse = await axios.post(
          `${API_BASE_URL}/student-responses/upload-metadata`,
          { metadata: metadataCopy },
          {
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${authToken}`,
            },
            timeout: 10000,
          }
        );

        if (fallbackResponse.data && fallbackResponse.data.metadataUrl) {
          console.log("Fallback metadata upload successful");
          return fallbackResponse.data.metadataUrl;
        }
      } catch (secondaryError: any) {
        console.error(
          "Fallback metadata upload also failed:",
          secondaryError.message
        );
      }

      // Store metadata locally if all upload attempts fail
      try {
        const metadataKey = `metadata_${metadata.recordingId}`;
        await AsyncStorage.setItem(metadataKey, JSON.stringify(metadataCopy));
        console.log("Metadata saved locally for later upload");
      } catch (storageError) {
        console.error("Failed to save metadata locally:", storageError);
      }

      return null; // Continue with the process even if metadata upload fails
    } catch (error: any) {
      console.error("Metadata upload error:", error.message);
      if (error.response) {
        console.error("Response status:", error.response.status);
        console.error("Response data:", JSON.stringify(error.response.data));
      }
      return null;
    }
  };

  // Submit all responses to the backend
  const submitResponses = async () => {
    if (!currentStudent || !assessment) {
      Alert.alert("Error", "Missing student or assessment data");
      return;
    }

    try {
      setIsSubmitting(true);

      // Stop recording
      const audioFileUri = await stopFullRecording();

      if (!audioFileUri) {
        setIsSubmitting(false);
        Alert.alert("Error", "Failed to get recording file");
        return;
      }

      // Create metadata for the recording
      const metadata = createAudioMetadata();
      console.log("Created metadata for submission");

      // Upload audio file to get cloud URL
      let audioUrl;
      let metadataUrl = null;
      try {
        audioUrl = await uploadAudio(audioFileUri);
        console.log("Audio uploaded successfully:", audioUrl);

        // Update metadata with audio URL
        if (metadata) {
          metadata.audioUrl = audioUrl;
        }

        // Upload metadata if available
        if (metadata) {
          metadataUrl = await uploadMetadata(metadata);
          console.log("Metadata URL:", metadataUrl);
        }
      } catch (uploadError) {
        console.error("Audio upload failed:", uploadError);
        setIsSubmitting(false);
        Alert.alert(
          "Upload Error",
          "Failed to upload audio recording. Please try again."
        );
        return;
      }

      // Create response entries for each question timestamp
      const responses = questionTimestamps.map((timestamp) => ({
        questionId: timestamp.questionId,
        startTime: new Date(
          recordingStartTime + timestamp.startTime
        ).toISOString(),
        endTime: new Date(recordingStartTime + timestamp.endTime).toISOString(),
        audioUrl: audioUrl, // Add the audio URL to each response
        metadataUrl: metadataUrl, // Add the metadata URL to each response
        // Include timestamp info in seconds for easier processing
        startTimeSeconds: Math.floor(timestamp.startTime / 1000),
        endTimeSeconds: Math.floor(timestamp.endTime / 1000),
        durationSeconds: Math.floor(
          (timestamp.endTime - timestamp.startTime) / 1000
        ),
      }));

      console.log("Submitting response data with audio URL and metadata URL");

      // Submit to audio assessment endpoint
      const authToken = await AsyncStorage.getItem("authToken");

      const payload = {
        assessmentId: assessment.id,
        studentId: currentStudent.id,
        responses,
        audioUrl, // Also add at the top level for flexibility
        metadataUrl, // Include metadata URL if available
        timestamps: questionTimestamps, // Include raw timestamps for reference
      };

      console.log("Submission payload prepared");

      // Add detailed logging of the payload
      console.log("============ SUBMISSION PAYLOAD ============");
      console.log("Assessment ID:", assessment.id);
      console.log("Student ID:", currentStudent.id);
      console.log("Response count:", responses.length);
      console.log("Audio URL:", audioUrl);
      console.log("Metadata URL:", metadataUrl);
      console.log("Full responses array:", JSON.stringify(responses, null, 2));
      console.log("==========================================");

      try {
        const response = await axios.post(
          `${API_BASE_URL}/student-responses/audio-assessment`,
          payload,
          { headers: { Authorization: `Bearer ${authToken}` } }
        );

        console.log("Submission response:", response.status);
        console.log(
          "Submission response data:",
          JSON.stringify(response.data, null, 2)
        );

        Alert.alert(
          "Submission Complete",
          "All responses have been recorded successfully",
          [{ text: "OK", onPress: () => router.push("/Screens/assessments") }]
        );
      } catch (error: any) {
        console.error("Submission error:", error.message);

        // Create a fallback for offline use
        const existingData = await AsyncStorage.getItem("pendingSubmissions");
        const pendingSubmissions = existingData ? JSON.parse(existingData) : [];

        pendingSubmissions.push({
          timestamp: new Date().toISOString(),
          studentId: currentStudent.id,
          assessmentId: assessment.id,
          responses,
          audioUri: audioFileUri,
          audioUrl,
          metadata,
          metadataUrl,
        });

        await AsyncStorage.setItem(
          "pendingSubmissions",
          JSON.stringify(pendingSubmissions)
        );

        Alert.alert(
          "Saved Locally",
          "Could not reach server. Responses saved locally for later submission.",
          [{ text: "OK", onPress: () => router.push("/Screens/assessments") }]
        );
      }
    } catch (error) {
      console.error("Process error:", error);
      setIsSubmitting(false);
      Alert.alert("Error", "Failed to process and submit responses");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Move to next question
  const goToNextQuestion = () => {
    // Ensure current question has timestamps
    if (!questionCompleted) {
      Alert.alert(
        "Incomplete Recording",
        "Please record the student's response before proceeding"
      );
      return;
    }

    // Check if we've reached the end
    if (currentQuestionIndex >= allQuestions.length - 1) {
      setIsCompleted(true);
      return;
    }

    // Move to next question
    setCurrentQuestionIndex(currentQuestionIndex + 1);
  };

  // Move to previous question
  const goToPreviousQuestion = () => {
    if (currentQuestionIndex > 0) {
      setCurrentQuestionIndex(currentQuestionIndex - 1);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <StatusBar
          barStyle="dark-content"
          backgroundColor={Colors.background}
        />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={Colors.primary} />
          <Text style={styles.loadingText}>Loading assessment...</Text>
        </View>
      </SafeAreaView>
    );
  }

  // Show student selection if no student is selected
  if (!currentStudent) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <StatusBar
          barStyle="dark-content"
          backgroundColor={Colors.background}
        />
        <View style={styles.container}>
          <View style={styles.header}>
            <TouchableOpacity
              style={styles.backButton}
              onPress={() => router.back()}
            >
              <Text style={styles.backButtonText}>←</Text>
            </TouchableOpacity>
            <Text style={styles.title}>Select Student</Text>
          </View>

          {error && (
            <View style={styles.errorContainer}>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          )}

          <ScrollView contentContainerStyle={styles.studentListContainer}>
            {students.map((student) => (
              <TouchableOpacity
                key={student.id}
                style={styles.studentCard}
                onPress={() => selectStudent(student)}
              >
                <View style={styles.studentInitialContainer}>
                  <Text style={styles.studentInitial}>
                    {student.name.charAt(0)}
                  </Text>
                </View>
                <View style={styles.studentInfo}>
                  <Text style={styles.studentName}>{student.name}</Text>
                  <Text style={styles.studentGender}>
                    {student.gender === "MALE" ? "Boy" : "Girl"} •{" "}
                    {student.status === "ACTIVE" ? "Active" : "Inactive"}
                  </Text>
                </View>
              </TouchableOpacity>
            ))}

            {students.length === 0 && (
              <View style={styles.emptyContainer}>
                <Text style={styles.emptyText}>No students available</Text>
              </View>
            )}
          </ScrollView>
        </View>
      </SafeAreaView>
    );
  }

  // Check if current question already has timestamps
  const currentQuestionHasTimestamps = questionTimestamps.some(
    (ts) => ts.questionId === currentQuestion?.id
  );

  const currentTimestamp = currentQuestion
    ? questionTimestamps.find((ts) => ts.questionId === currentQuestion.id)
    : null;

  const isQuestionInProgress = Boolean(
    currentTimestamp && currentTimestamp.endTime === 0
  );

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor={Colors.background} />
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => {
              if (isRecording) {
                Alert.alert(
                  "Assessment in Progress",
                  "Please finish the assessment before going back"
                );
                return;
              }

              // Confirm if user wants to abandon assessment
              Alert.alert(
                "Cancel Assessment",
                "Are you sure you want to cancel this assessment? All recordings will be lost.",
                [
                  { text: "No", style: "cancel" },
                  {
                    text: "Yes",
                    style: "destructive",
                    onPress: () => {
                      if (recording) {
                        recording.stopAndUnloadAsync().catch(console.error);
                      }
                      setCurrentStudent(null);
                      router.back();
                    },
                  },
                ]
              );
            }}
          >
            <Text style={styles.backButtonText}>←</Text>
          </TouchableOpacity>
          <Text style={styles.title}>{assessment?.name}</Text>
        </View>

        <View style={styles.studentBadge}>
          <Text style={styles.studentBadgeText}>
            Student: {currentStudent.name}
          </Text>
        </View>

        <View style={styles.progressContainer}>
          <Text style={styles.progressText}>
            Question {currentQuestionIndex + 1} of {allQuestions.length}
          </Text>
          <View style={styles.progressBar}>
            <View
              style={[
                styles.progressFill,
                {
                  width: `${
                    ((currentQuestionIndex + 1) / allQuestions.length) * 100
                  }%`,
                },
              ]}
            />
          </View>
        </View>

        {currentQuestion && (
          <View style={styles.questionContainer}>
            <Text style={styles.questionText}>{currentQuestion.text}</Text>
            {currentQuestion.imageUrl && (
              <View>
                <Image
                  source={{ uri: currentQuestion.imageUrl }}
                  style={{ width: "100%", height: 200 }}
                  resizeMode="contain"
                />
              </View>
            )}
            <View style={styles.recordingContainer}>
              {!isQuestionInProgress && !questionCompleted && (
                <TouchableOpacity
                  style={styles.recordButton}
                  onPress={markQuestionStart}
                >
                  <Text style={styles.recordButtonText}>Start Question</Text>
                </TouchableOpacity>
              )}

              {isQuestionInProgress && (
                <View style={styles.recordingActiveContainer}>
                  <View style={styles.recordingIndicator}>
                    <View style={styles.recordingDot} />
                    <Text style={styles.recordingText}>Recording...</Text>
                  </View>

                  <TouchableOpacity
                    style={styles.stopButton}
                    onPress={markQuestionEnd}
                  >
                    <Text style={styles.stopButtonText}>End Question</Text>
                  </TouchableOpacity>
                </View>
              )}

              {questionCompleted && (
                <View style={styles.recordingCompleteContainer}>
                  <Text style={styles.recordingCompleteText}>
                    Question Complete
                  </Text>
                </View>
              )}
            </View>
          </View>
        )}

        <View style={styles.navigationContainer}>
          <TouchableOpacity
            style={[
              styles.navButton,
              currentQuestionIndex === 0 ? styles.disabledButton : {},
            ]}
            onPress={goToPreviousQuestion}
            disabled={currentQuestionIndex === 0 || isQuestionInProgress}
          >
            <Text style={styles.navButtonText}>Previous</Text>
          </TouchableOpacity>

          {isCompleted ? (
            <TouchableOpacity
              style={[
                styles.submitButton,
                isSubmitting ? styles.disabledButton : {},
              ]}
              onPress={submitResponses}
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <ActivityIndicator color="#FFFFFF" size="small" />
              ) : (
                <Text style={styles.submitButtonText}>Finish & Submit</Text>
              )}
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={[
                styles.navButton,
                !questionCompleted ? styles.disabledButton : {},
              ]}
              onPress={goToNextQuestion}
              disabled={!questionCompleted || isQuestionInProgress}
            >
              <Text style={styles.navButtonText}>Next</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    </SafeAreaView>
  );
};

export default TakeAssessment;

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
  studentListContainer: {
    padding: width * 0.05,
  },
  studentCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Colors.surface,
    borderRadius: 16,
    padding: 15,
    marginBottom: 15,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
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
  studentGender: {
    fontSize: 14,
    color: Colors.textSecondary,
  },
  emptyContainer: {
    padding: 30,
    alignItems: "center",
  },
  emptyText: {
    color: Colors.textSecondary,
    fontSize: 16,
  },
  studentBadge: {
    backgroundColor: Colors.primary + "15",
    borderRadius: 12,
    paddingHorizontal: 15,
    paddingVertical: 8,
    marginHorizontal: width * 0.05,
    marginTop: 15,
  },
  studentBadgeText: {
    color: Colors.primary,
    fontWeight: "600",
    fontSize: 14,
  },
  progressContainer: {
    paddingHorizontal: width * 0.05,
    marginTop: 15,
  },
  progressText: {
    fontSize: 14,
    color: Colors.textSecondary,
    marginBottom: 8,
  },
  progressBar: {
    height: 6,
    backgroundColor: Colors.border,
    borderRadius: 3,
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    backgroundColor: Colors.primary,
  },
  questionContainer: {
    flex: 1,
    padding: width * 0.05,
    marginTop: 20,
  },
  questionText: {
    fontSize: 18,
    fontWeight: "600",
    color: Colors.textPrimary,
    marginBottom: 30,
    lineHeight: 28,
  },
  recordingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  recordButton: {
    backgroundColor: Colors.primary,
    borderRadius: 30,
    paddingHorizontal: 30,
    paddingVertical: 15,
    minWidth: width * 0.5,
    alignItems: "center",
  },
  recordButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "600",
  },
  recordingActiveContainer: {
    alignItems: "center",
    justifyContent: "center",
  },
  recordingIndicator: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 20,
  },
  recordingDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: Colors.error,
    marginRight: 8,
  },
  recordingText: {
    fontSize: 16,
    color: Colors.error,
    fontWeight: "600",
  },
  stopButton: {
    backgroundColor: Colors.error,
    borderRadius: 30,
    paddingHorizontal: 30,
    paddingVertical: 15,
    minWidth: width * 0.5,
    alignItems: "center",
  },
  stopButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "600",
  },
  recordingCompleteContainer: {
    alignItems: "center",
  },
  recordingCompleteText: {
    fontSize: 16,
    color: Colors.success,
    fontWeight: "600",
    marginBottom: 20,
  },
  navigationContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: width * 0.05,
    paddingVertical: 20,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  navButton: {
    backgroundColor: Colors.surface,
    borderRadius: 12,
    paddingHorizontal: 20,
    paddingVertical: 12,
    minWidth: width * 0.3,
    alignItems: "center",
    borderWidth: 1,
    borderColor: Colors.border,
  },
  navButtonText: {
    color: Colors.textPrimary,
    fontSize: 16,
    fontWeight: "600",
  },
  disabledButton: {
    opacity: 0.5,
  },
  submitButton: {
    backgroundColor: Colors.primary,
    borderRadius: 12,
    paddingHorizontal: 20,
    paddingVertical: 12,
    minWidth: width * 0.6,
    alignItems: "center",
  },
  submitButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "600",
  },
});
