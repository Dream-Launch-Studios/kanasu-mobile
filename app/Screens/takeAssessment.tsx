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
  Platform,
  Modal,
} from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import Colors from "@/constants/Colors";
import axios from "axios";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { API_URL } from "@/constants/api";
import { Audio } from "expo-av";
import { Ionicons } from "@expo/vector-icons";

const { width, height } = Dimensions.get("window");

interface Question {
  id: string;
  text: string;
  imageUrl?: string;
  questionType: string;
  options?: any[];
  audioUrl?: string;
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
  const [sound, setSound] = useState<Audio.Sound | null>(null);
  const [isAudioPlaying, setIsAudioPlaying] = useState(false);

  // Continuous recording state
  const [recording, setRecording] = useState<Audio.Recording | null>(null);
  const [recordingStartTime, setRecordingStartTime] = useState<number>(0);
  const [isRecording, setIsRecording] = useState(false);
  const [audioUri, setAudioUri] = useState<string | null>(null);
  const [questionTimestamps, setQuestionTimestamps] = useState<
    QuestionTimestamp[]
  >([]);

  // Countdown state
  const [isCountingDown, setIsCountingDown] = useState(false);
  const [countdownValue, setCountdownValue] = useState(3);

  const [questionCompleted, setQuestionCompleted] = useState<boolean>(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isCompleted, setIsCompleted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Bottom sheet state
  const [showSubmitConfirmation, setShowSubmitConfirmation] = useState(false);

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
      console.log(
        "All Questions Data:",
        questions.map((q) => ({
          id: q.id,
          text: q.text,
          imageUrl: q.imageUrl,
          questionType: q.questionType,
          options: q.options,
          audioUrl: q.audioUrl,
        }))
      );
      console.log(
        "Audio URLs for all questions:",
        questions.map((q) => q.audioUrl)
      );
      setAllQuestions(questions);
      if (questions.length > 0) {
        setCurrentQuestion(questions[0]);
      }
    }
  }, [assessment]);

  // Update current question when index changes
  useEffect(() => {
    if (allQuestions.length > 0 && currentQuestionIndex < allQuestions.length) {
      const newQuestion = allQuestions[currentQuestionIndex];
      console.log("Current Question Data:", {
        id: newQuestion.id,
        text: newQuestion.text,
        imageUrl: newQuestion.imageUrl,
        questionType: newQuestion.questionType,
        options: newQuestion.options,
        audioUrl: newQuestion.audioUrl,
      });
      console.log("Audio URL for current question:", newQuestion.audioUrl);
      setCurrentQuestion(newQuestion);
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
          `${API_URL}/global-assessments/${assessmentId}`,
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

    // Start countdown before recording
    startCountdown();
  };

  // Start countdown, then start recording
  const startCountdown = () => {
    setIsCountingDown(true);
    setCountdownValue(3);

    const countdownInterval = setInterval(() => {
      setCountdownValue((prev) => {
        if (prev <= 1) {
          clearInterval(countdownInterval);
          setIsCountingDown(false);
          // Start recording after countdown
          startFullRecording();
          return 3; // Reset for next time
        }
        return prev - 1;
      });
    }, 1000);
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
        type: "audio/aac",
        name: `recording_${Date.now()}.acc`,
      } as any);

      console.log("Sending request to upload endpoint with file field...");

      // Additional logging to diagnose issues
      console.log(
        "FormData contents:",
        JSON.stringify({
          fieldName: "file",
          uri: uri.substring(0, 50) + "...", // Show part of the URI for debugging
          type: "audio/acc",
          name: `recording_${Date.now()}.acc`,
        })
      );

      // Change to a working endpoint (questions/upload-audio)
      const uploadEndpoint = `${API_URL}/questions/upload-audio`;
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
          `${API_URL}/student-responses/upload-metadata`,
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
          `${API_URL}/student-responses/upload-metadata`,
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

  // Show bottom sheet instead of alert
  const handleSubmitPress = () => {
    setShowSubmitConfirmation(true);
  };

  // Handle confirmation from bottom sheet
  const handleSubmitConfirm = async () => {
    setShowSubmitConfirmation(false);
    // Call the actual submit function
    await submitResponses();
  };

  // Handle cancellation from bottom sheet
  const handleSubmitCancel = () => {
    setShowSubmitConfirmation(false);
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

      // Store response locally
      const localResponse = {
        studentId: currentStudent.id,
        studentName: currentStudent.name,
        assessmentId: assessment.id,
        assessmentName: assessment.name,
        audioUri: audioFileUri,
        metadata: metadata,
        timestamps: questionTimestamps,
        recordedAt: new Date().toISOString(),
        status: "pending" as const,
      };

      // Get existing responses from AsyncStorage
      const existingResponses = await AsyncStorage.getItem("pendingResponses");
      const pendingResponses = existingResponses
        ? JSON.parse(existingResponses)
        : [];

      // Add new response
      pendingResponses.push(localResponse);

      // Save back to AsyncStorage
      await AsyncStorage.setItem(
        "pendingResponses",
        JSON.stringify(pendingResponses)
      );

      // Reset state for next student
      setCurrentQuestionIndex(0);
      setQuestionTimestamps([]);
      setQuestionCompleted(false);
      setIsCompleted(false);
      setIsSubmitting(false);
      setAudioUri(null);
      setRecording(null);
      setIsRecording(false);

      // Find the next student in the list
      const currentIndex = students.findIndex(
        (s) => s.id === currentStudent.id
      );
      const nextStudent = students[currentIndex + 1];

      if (nextStudent) {
        // Start assessment for next student
        selectStudent(nextStudent);
      } else {
        // If no more students, show completion message
        Alert.alert(
          "Assessment Complete",
          "All students have been assessed. You can upload the responses later from the Pending Uploads section.",
          [
            {
              text: "OK",
              onPress: () => router.push("/Screens/pendingUploads"),
            },
          ]
        );
      }
    } catch (error) {
      console.error("Process error:", error);
      setIsSubmitting(false);
      Alert.alert("Error", "Failed to save responses locally");
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

  // Skip current student and move to next
  const skipStudent = () => {
    if (!currentStudent || !students) return;

    const currentIndex = students.findIndex((s) => s.id === currentStudent.id);
    const nextStudent = students[currentIndex + 1];

    if (recording) {
      recording.stopAndUnloadAsync().catch(console.error);
    }

    setCurrentQuestionIndex(0);
    setQuestionTimestamps([]);
    setQuestionCompleted(false);
    setIsCompleted(false);
    setAudioUri(null);
    setRecording(null);
    setIsRecording(false);

    if (nextStudent) {
      selectStudent(nextStudent);
    } else {
      Alert.alert(
        "Assessment Complete",
        "All students have been assessed. You can now go back.",
        [{ text: "OK", onPress: () => router.back() }]
      );
    }
  };

  // Play audio function
  const playQuestionAudio = async () => {
    if (!currentQuestion?.audioUrl) {
      console.log("No audio URL available for this question");
      Alert.alert("Audio Error", "No audio available for this question");
      return;
    }

    try {
      console.log(
        "Attempting to play audio from URL:",
        currentQuestion.audioUrl
      );

      // Stop previous audio if playing
      if (sound) {
        await sound.stopAsync();
        await sound.unloadAsync();
        setSound(null);
      }

      // Set audio mode first to ensure playback works
      console.log("Setting audio mode for playback");
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
        staysActiveInBackground: true,
        interruptionModeIOS: 1, // DoNotMix
        interruptionModeAndroid: 1, // DoNotMix
        shouldDuckAndroid: false,
        playThroughEarpieceAndroid: false,
      });

      setIsAudioPlaying(true);

      // Try to create and load the sound with higher volume
      console.log("Creating new sound object");
      const { sound: newSound } = await Audio.Sound.createAsync(
        { uri: currentQuestion.audioUrl },
        { shouldPlay: true, volume: 1.0, progressUpdateIntervalMillis: 100 }
      );

      setSound(newSound);

      // Make sure the volume is at maximum
      await newSound.setVolumeAsync(1.0);

      // Listen for playback status updates with improved logging
      newSound.setOnPlaybackStatusUpdate((status) => {
        if (status.isLoaded) {
          console.log(
            "Audio playback status:",
            status.isPlaying ? "Playing" : "Paused",
            "Position:",
            status.positionMillis,
            "Duration:",
            status.durationMillis,
            "Volume:",
            status.volume
          );

          if (status.didJustFinish) {
            console.log("Audio playback finished");
            setIsAudioPlaying(false);
            newSound.unloadAsync();
          }
        } else if (status.error) {
          console.error("Audio playback error:", status.error);
          setIsAudioPlaying(false);
          Alert.alert("Audio Error", `Playback error: ${status.error}`);
        }
      });

      // Confirm audio is playing
      console.log("Audio should be playing now");
    } catch (error: any) {
      console.error("Error playing audio:", error);
      setIsAudioPlaying(false);
      Alert.alert(
        "Audio Error",
        `Failed to play the audio: ${error.message || "Unknown error"}`
      );

      // Additional diagnostics
      console.log(
        "Audio URL format:",
        currentQuestion.audioUrl
          ? currentQuestion.audioUrl.substring(0, 30) + "..."
          : "null"
      );
      console.log("Device info:", Platform.OS, Platform.Version);
    }
  };

  // Clean up audio when component unmounts
  useEffect(() => {
    return () => {
      if (sound) {
        sound.unloadAsync();
      }
    };
  }, [sound]);

  // Clean up audio when current question changes
  useEffect(() => {
    if (sound) {
      sound.unloadAsync();
      setSound(null);
      setIsAudioPlaying(false);
    }
  }, [currentQuestionIndex]);

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

  // Render countdown overlay if counting down
  if (isCountingDown && currentStudent) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <StatusBar
          barStyle="dark-content"
          backgroundColor={Colors.background}
        />
        <View style={styles.countdownOverlay}>
          <Text style={styles.countdownTitle}>Recording starts in</Text>
          <View style={styles.countdownCircle}>
            <Text style={styles.countdownNumber}>{countdownValue}</Text>
          </View>
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
            <View style={styles.questionHeader}>
              <Text style={styles.questionText}>{currentQuestion.text}</Text>
              {currentQuestion.audioUrl && (
                <TouchableOpacity
                  style={styles.audioButton}
                  onPress={playQuestionAudio}
                  disabled={isAudioPlaying}
                >
                  <Ionicons
                    name={isAudioPlaying ? "volume-high" : "volume-medium"}
                    size={24}
                    color={
                      isAudioPlaying ? Colors.primary : Colors.textSecondary
                    }
                  />
                </TouchableOpacity>
              )}
            </View>
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
                  <Text style={styles.recordButtonText}>
                    Start Question | ಪ್ರಶ್ನೆ ಪ್ರಾರಂಭಿಸಿ
                  </Text>
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
                    <Text style={styles.stopButtonText}>
                      End Question | ಪ್ರಶ್ನೆ ಮುಗಿಸಿ
                    </Text>
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
          {isCompleted ? (
            <TouchableOpacity
              style={[
                styles.submitButton,
                isSubmitting ? styles.disabledButton : {},
              ]}
              onPress={handleSubmitPress}
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <ActivityIndicator color="#FFFFFF" size="small" />
              ) : (
                <Text style={styles.submitButtonText}>
                  Finish & Submit | ಮುಗಿಸಿ & ಸಲ್ಲಿಸಿ
                </Text>
              )}
            </TouchableOpacity>
          ) : (
            <View style={styles.navButtonsContainer}>
              <TouchableOpacity style={styles.skipButton} onPress={skipStudent}>
                <Text style={styles.skipButtonText}>
                  Skip | ಸ್ಕಿಪ್
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.navButton,
                  !questionCompleted ? styles.disabledButton : {},
                ]}
                onPress={goToNextQuestion}
                disabled={!questionCompleted || isQuestionInProgress}
              >
                <Text style={styles.navButtonText}>Next | ಮುಂದೆ</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </View>

      {/* Bottom Sheet Confirmation */}
      <Modal
        visible={showSubmitConfirmation}
        transparent={true}
        animationType="slide"
        onRequestClose={handleSubmitCancel}
      >
        <TouchableOpacity 
          style={styles.modalOverlay} 
          activeOpacity={1} 
          onPress={handleSubmitCancel}
        >
          <View style={styles.bottomSheet}>
            <View style={styles.bottomSheetHandle} />
            <Text style={styles.bottomSheetTitle}>
              Are you sure you want to submit the response?
            </Text>
            <Text style={styles.bottomSheetSubtext}>
              Once submitted, you move onto next student.
            </Text>
            <View style={styles.bottomSheetButtons}>
              <TouchableOpacity
                style={styles.bottomSheetCancelButton}
                onPress={handleSubmitCancel}
              >
                <Text style={styles.bottomSheetCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.bottomSheetConfirmButton}
                onPress={handleSubmitConfirm}
              >
                <Text style={styles.bottomSheetConfirmText}>Submit</Text>
              </TouchableOpacity>
            </View>
          </View>
        </TouchableOpacity>
      </Modal>
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
  questionHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 30,
  },
  questionText: {
    flex: 1,
    fontSize: 18,
    fontWeight: "600",
    color: Colors.textPrimary,
    lineHeight: 28,
  },
  audioButton: {
    padding: 10,
    marginLeft: 10,
    borderRadius: 20,
    backgroundColor: Colors.background,
    borderWidth: 1,
    borderColor: Colors.border,
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
    backgroundColor: Colors.success,
    marginRight: 8,
  },
  recordingText: {
    fontSize: 16,
    color: Colors.success,
    fontWeight: "600",
  },
  stopButton: {
    backgroundColor: Colors.success,
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
    backgroundColor: Colors.background,
  },
  navButtonsContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    width: "100%",
    gap: 10,
  },
  navButton: {
    backgroundColor: Colors.surface,
    borderRadius: 12,
    paddingHorizontal: 20,
    paddingVertical: 15,
    flex: 1,
    alignItems: "center",
    borderWidth: 1,
    borderColor: Colors.border,
  },
  navButtonText: {
    color: Colors.textPrimary,
    fontSize: 16,
    fontWeight: "600",
  },
  skipButton: {
    backgroundColor: "#FFA500",
    borderRadius: 12,
    paddingHorizontal: 20,
    paddingVertical: 15,
    flex: 1,
    alignItems: "center",
  },
  skipButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "600",
  },
  submitButton: {
    backgroundColor: Colors.primary,
    borderRadius: 12,
    paddingHorizontal: 25,
    paddingVertical: 15,
    minWidth: width * 0.6,
    alignItems: "center",
  },
  submitButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "600",
  },
  disabledButton: {
    opacity: 0.5,
  },
  countdownOverlay: {
    flex: 1,
    backgroundColor: Colors.background,
    justifyContent: "center",
    alignItems: "center",
  },
  countdownTitle: {
    fontSize: 24,
    fontWeight: "600",
    color: Colors.textPrimary,
    marginBottom: 50,
  },
  countdownCircle: {
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: Colors.primary + "30",
    justifyContent: "center",
    alignItems: "center",
  },
  countdownNumber: {
    fontSize: 100,
    fontWeight: "bold",
    color: Colors.textPrimary,
  },
  // Bottom sheet styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  bottomSheet: {
    backgroundColor: Colors.background,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    paddingBottom: 40,
  },
  bottomSheetHandle: {
    width: 40,
    height: 5,
    backgroundColor: Colors.border,
    borderRadius: 3,
    alignSelf: 'center',
    marginBottom: 20,
  },
  bottomSheetTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: Colors.textPrimary,
    marginBottom: 10,
  },
  bottomSheetSubtext: {
    fontSize: 16,
    color: Colors.textSecondary,
    marginBottom: 25,
  },
  bottomSheetButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  bottomSheetCancelButton: {
    flex: 1,
    padding: 15,
    marginRight: 10,
    borderRadius: 10,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  bottomSheetCancelText: {
    color: Colors.textPrimary,
    fontSize: 16,
    fontWeight: '500',
  },
  bottomSheetConfirmButton: {
    flex: 1,
    padding: 15,
    marginLeft: 10,
    borderRadius: 10,
    alignItems: 'center',
    backgroundColor: Colors.primary,
  },
  bottomSheetConfirmText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '500',
  },
});
