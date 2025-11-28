import axios from 'axios';
import { Audio } from 'expo-av';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { WebView } from 'react-native-webview';

const API_BASE_URL = 'http://192.168.43.198:8000';

export default function App() {
  const camera = useRef(null);
  const [facing, setFacing] = useState('back');
  const [permission, requestPermission] = useCameraPermissions();
  const [sound, setSound] = useState();
  
  const [isRecording, setIsRecording] = useState(false);
  const [caption, setCaption] = useState('');
  const [loading, setLoading] = useState(false);
  const [audioFile, setAudioFile] = useState(null);
  const [isAutoCaptureEnabled, setIsAutoCaptureEnabled] = useState(true); // Auto-enabled by default
  const captureIntervalRef = useRef(null);
  const [captureCount, setCaptureCount] = useState(0);
  const [lastResponse, setLastResponse] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const requestQueueRef = useRef([]);
  const [responseTime, setResponseTime] = useState(0);
  
  // WebView states
  const [showWebView, setShowWebView] = useState(false);
  const [webViewKey, setWebViewKey] = useState(0);
  const [detectedObjects, setDetectedObjects] = useState([]);
  const webViewRef = useRef(null);

  // Auto-scan states
  const [autoScanEnabled, setAutoScanEnabled] = useState(true); // Auto-scan enabled by default
  const [lastScanTime, setLastScanTime] = useState(0);
  const [scanInterval, setScanInterval] = useState(2000); // 2 seconds default interval
  const [objectConfidence, setObjectConfidence] = useState(0.6); // Minimum confidence threshold
  const scanTimeoutRef = useRef(null);

  // Configure audio mode on component mount
  useEffect(() => {
    const setupAudio = async () => {
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: false,
        playsInSilentModeIOS: true,
        shouldDuckAndroid: true,
        playThroughEarpieceAndroid: false,
        staysActiveInBackground: false,
      });
    };
    
    setupAudio();
  }, []);

  // Clean up sound on unmount
  useEffect(() => {
    return sound
      ? () => {
          console.log('Unloading Sound');
          sound.unloadAsync();
        }
      : undefined;
  }, [sound]);

  // Request camera permissions
  useEffect(() => {
    if (!permission?.granted) {
      requestPermission();
    }
  }, [permission]);

  // Auto-start continuous scanning when permissions are granted
  useEffect(() => {
    if (permission?.granted && autoScanEnabled && !showWebView) {
      startAutoScanning();
    }
    
    return () => {
      stopAutoScanning();
    };
  }, [permission?.granted, autoScanEnabled, showWebView]);

  // Process queue when not processing
  useEffect(() => {
    if (!isProcessing && requestQueueRef.current.length > 0 && isAutoCaptureEnabled) {
      processNextInQueue();
    }
  }, [isProcessing, isAutoCaptureEnabled]);

  const startAutoScanning = () => {
    console.log('🚀 Starting automatic continuous scanning');
    setIsRecording(true);
    setIsAutoCaptureEnabled(true);
    setCaptureCount(0);
    requestQueueRef.current = [];
    
    // Initial capture after a short delay
    setTimeout(() => {
      if (autoScanEnabled && !isProcessing) {
        handleAutoCapture();
      }
    }, 1000);
  };

  const stopAutoScanning = () => {
    console.log('🛑 Stopping automatic scanning');
    if (scanTimeoutRef.current) {
      clearTimeout(scanTimeoutRef.current);
      scanTimeoutRef.current = null;
    }
    setIsRecording(false);
    setIsAutoCaptureEnabled(false);
  };

  const scheduleNextScan = () => {
    if (scanTimeoutRef.current) {
      clearTimeout(scanTimeoutRef.current);
    }
    
    if (autoScanEnabled && !isProcessing && !showWebView) {
      scanTimeoutRef.current = setTimeout(() => {
        if (autoScanEnabled && !isProcessing && !showWebView) {
          handleAutoCapture();
        }
      }, scanInterval);
    }
  };

  const handleAutoCapture = async () => {
    if (camera.current && !isProcessing && autoScanEnabled && !showWebView) {
      try {
        const photo = await camera.current.takePictureAsync({
          quality: 0.4, // Lower quality for faster processing
          base64: false,
          skipProcessing: true,
          exif: false,
        });

        console.log(`🔍 Auto-capture ${captureCount + 1}:`, photo.uri);
        
        // Add to queue and process immediately if not processing
        requestQueueRef.current.push(photo.uri);
        setCaptureCount(prev => prev + 1);
        setLastScanTime(Date.now());
        
        if (!isProcessing) {
          processNextInQueue();
        }
        
      } catch (error) {
        console.error('Error in auto capture:', error);
        // Schedule next attempt even if this one failed
        scheduleNextScan();
      }
    }
  };

  const processNextInQueue = async () => {
    if (requestQueueRef.current.length === 0 || isProcessing || !autoScanEnabled) {
      scheduleNextScan();
      return;
    }

    const imageUri = requestQueueRef.current.shift(); // Get next image from queue
    await uploadImage(imageUri);
  };

  const takePicture = async () => {
    if (camera.current && !isProcessing) {
      try {
        const photo = await camera.current.takePictureAsync({
          quality: 0.7,
          base64: false,
          skipProcessing: false,
        });

        console.log('Manual photo taken:', photo.uri);
        await uploadImage(photo.uri);
      } catch (error) {
        console.error('Error taking picture:', error);
        Alert.alert('Error', 'Failed to take picture');
      }
    }
  };

  const uploadImage = async (imageUri) => {
    const startTime = Date.now();
    setIsProcessing(true);
    
    try {
      const formData = new FormData();
      formData.append('file', {
        uri: imageUri,
        type: 'image/jpeg',
        name: `photo_${Date.now()}.jpg`,
      });

      console.log('📤 Uploading image to:', `${API_BASE_URL}/caption`);
      const response = await axios.post(`${API_BASE_URL}/caption`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
        timeout: 30000,
      });

      const endTime = Date.now();
      const responseTimeMs = endTime - startTime;
      setResponseTime(responseTimeMs);

      console.log('✅ Response received:', response.data);
      setCaption(response.data.caption);
      setAudioFile(response.data.audio_file);
      setLastResponse(new Date().toLocaleTimeString());
      
      // Auto-play the audio only for significant changes
      if (response.data.audio_file && shouldPlayAudio(response.data.caption)) {
        await playAudio(response.data.audio_file);
      }

    } catch (error) {
      console.error('❌ Upload error:', error);
      const endTime = Date.now();
      setResponseTime(endTime - startTime);
      
      if (!autoScanEnabled) {
        if (error.response) {
          Alert.alert('Server Error', `Server responded with status ${error.response.status}`);
        } else if (error.request) {
          Alert.alert(
            'Connection Error', 
            `Cannot connect to server at ${API_BASE_URL}. Make sure your server is running and accessible from this network.`
          );
        } else {
          Alert.alert('Error', `Failed to process image: ${error.message}`);
        }
      }
    } finally {
      setIsProcessing(false);
      
      // Schedule next scan after processing completes
      scheduleNextScan();
    }
  };

  // Simple logic to prevent audio spam - only play for significantly different captions
  const shouldPlayAudio = (newCaption) => {
    if (!caption) return true;
    
    const words1 = caption.toLowerCase().split(' ');
    const words2 = newCaption.toLowerCase().split(' ');
    const commonWords = words1.filter(word => words2.includes(word));
    const similarity = commonWords.length / Math.max(words1.length, words2.length);
    
    return similarity < 0.7;
  };

  const playAudio = async (filename) => {
    try {
      const audioUrl = `${API_BASE_URL}/audio/${filename}`;
      console.log('🔊 Playing audio from:', audioUrl);

      if (sound) {
        await sound.stopAsync();
        await sound.unloadAsync();
      }

      const { sound: newSound } = await Audio.Sound.createAsync(
        { uri: audioUrl },
        { shouldPlay: true }
      );
      
      setSound(newSound);

      newSound.setOnPlaybackStatusUpdate((status) => {
        if (status.didJustFinish) {
          console.log('Audio finished playing');
        }
      });

    } catch (error) {
      console.error('Error playing audio:', error);
      if (!autoScanEnabled) {
        Alert.alert('Audio Error', 'Failed to play audio description.');
      }
    }
  };

  const stopAudio = async () => {
    if (sound) {
      await sound.stopAsync();
      await sound.unloadAsync();
      setSound(null);
    }
  };

  const toggleCameraFacing = () => {
    setFacing(current => (current === 'back' ? 'front' : 'back'));
  };

  const toggleAutoScan = () => {
    const newAutoScanState = !autoScanEnabled;
    setAutoScanEnabled(newAutoScanState);
    
    if (newAutoScanState) {
      startAutoScanning();
      Alert.alert('Auto Scan Enabled', 'Continuous automatic scanning started');
    } else {
      stopAutoScanning();
      Alert.alert('Auto Scan Disabled', 'Automatic scanning stopped');
    }
  };

  const handleCameraReady = () => {
    console.log('Camera is ready');
  };

  const handleCameraError = (error) => {
    console.error('Camera error:', error);
  };

  // WebView functions
  const openMediaPipe = () => {
    setShowWebView(true);
    setWebViewKey(prev => prev + 1); // Force re-render
  };

  const closeMediaPipe = () => {
    setShowWebView(false);
    setDetectedObjects([]);
    // Resume auto-scanning when returning from WebView
    if (autoScanEnabled) {
      startAutoScanning();
    }
  };

  const handleWebViewMessage = (event) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);
      console.log('Received from WebView:', data);
      
      if (data.type === 'OBJECT_DETECTION') {
        setDetectedObjects(data.objects || []);
        
        // Trigger server processing if objects detected with sufficient confidence
        const highConfidenceObjects = data.objects.filter(obj => 
          obj.probability >= objectConfidence
        );
        
        if (highConfidenceObjects.length > 0 && !isProcessing && autoScanEnabled) {
          console.log('🎯 High confidence objects detected, triggering capture');
          handleObjectDetection(highConfidenceObjects);
        }
      }
    } catch (error) {
      console.error('Error parsing WebView message:', error);
    }
  };

  const handleObjectDetection = async (objects) => {
    if (isProcessing || !autoScanEnabled) return;
    
    console.log('Objects detected:', objects);
    
    // Take picture when objects are detected
    try {
      if (camera.current) {
        const photo = await camera.current.takePictureAsync({
          quality: 0.5,
          base64: false,
          skipProcessing: true,
        });
        
        console.log('🎯 Object detection triggered capture:', photo.uri);
        await uploadImage(photo.uri);
      }
    } catch (error) {
      console.error('Error capturing from object detection:', error);
    }
  };

  const injectObjectData = () => {
    if (webViewRef.current) {
      const objectData = {
        type: 'INIT_OBJECTS',
        objects: detectedObjects
      };
      webViewRef.current.injectJavaScript(`
        window.receivedObjectData(${JSON.stringify(objectData)});
        true;
      `);
    }
  };

  const adjustScanInterval = (increase = false) => {
    setScanInterval(prev => {
      let newInterval;
      if (increase) {
        newInterval = Math.min(prev + 1000, 10000); // Max 10 seconds
      } else {
        newInterval = Math.max(prev - 1000, 500); // Min 0.5 seconds
      }
      console.log(`Scan interval adjusted to: ${newInterval}ms`);
      return newInterval;
    });
  };

  const adjustConfidence = (increase = false) => {
    setObjectConfidence(prev => {
      let newConfidence;
      if (increase) {
        newConfidence = Math.min(prev + 0.1, 0.9); // Max 90%
      } else {
        newConfidence = Math.max(prev - 0.1, 0.3); // Min 30%
      }
      console.log(`Confidence threshold adjusted to: ${(newConfidence * 100).toFixed(0)}%`);
      return newConfidence;
    });
  };

  if (showWebView) {
    return (
      <View style={styles.container}>
        <WebView
          key={webViewKey}
          ref={webViewRef}
          source={{ uri: `${API_BASE_URL}/mediapipe` }}
          style={styles.webview}
          onMessage={handleWebViewMessage}
          onLoadEnd={injectObjectData}
          javaScriptEnabled={true}
          domStorageEnabled={true}
          startInLoadingState={true}
          renderLoading={() => (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color="#0000ff" />
              <Text style={styles.loadingText}>Loading MediaPipe...</Text>
            </View>
          )}
        />
        
        <View style={styles.webviewControls}>
          <TouchableOpacity style={styles.closeButton} onPress={closeMediaPipe}>
            <Text style={styles.closeButtonText}>Close MediaPipe</Text>
          </TouchableOpacity>
          
          {detectedObjects.length > 0 && (
            <View style={styles.objectsContainer}>
              <Text style={styles.objectsTitle}>Detected Objects:</Text>
              {detectedObjects.map((obj, index) => (
                <Text key={index} style={styles.objectText}>
                  {obj.className} ({(obj.probability * 100).toFixed(1)}%)
                </Text>
              ))}
            </View>
          )}
        </View>
      </View>
    );
  }

  if (!permission) {
    return (
      <View style={styles.container}>
        <Text style={styles.message}>Requesting camera permission...</Text>
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <View style={styles.container}>
        <Text style={styles.message}>We need your permission to use the camera</Text>
        <TouchableOpacity style={styles.button} onPress={requestPermission}>
          <Text style={styles.buttonText}>Grant Permission</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <CameraView
        ref={camera}
        style={styles.camera}
        facing={facing}
        mode="picture"
        zoom={0}
        onCameraReady={handleCameraReady}
        onMountError={handleCameraError}
      />
      
      <View style={styles.overlay}>
        {/* Camera Flip Button */}
        <TouchableOpacity style={styles.flipButton} onPress={toggleCameraFacing}>
          <Text style={styles.flipText}>🔄</Text>
        </TouchableOpacity>

        {/* MediaPipe Button */}
        <TouchableOpacity style={styles.mediaPipeButton} onPress={openMediaPipe}>
          <Text style={styles.mediaPipeText}>🤖</Text>
        </TouchableOpacity>

        {/* Auto-scan Controls */}
        <View style={styles.autoScanControls}>
          <TouchableOpacity 
            style={[styles.autoScanButton, autoScanEnabled && styles.autoScanActive]} 
            onPress={toggleAutoScan}
          >
            <Text style={styles.autoScanText}>
              {autoScanEnabled ? '🔴' : '⚪'}
            </Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={styles.intervalButton} 
            onPress={() => adjustScanInterval(false)}
          >
            <Text style={styles.intervalText}>-</Text>
          </TouchableOpacity>
          
          <View style={styles.intervalDisplay}>
            <Text style={styles.intervalText}>{(scanInterval / 1000).toFixed(1)}s</Text>
          </View>
          
          <TouchableOpacity 
            style={styles.intervalButton} 
            onPress={() => adjustScanInterval(true)}
          >
            <Text style={styles.intervalText}>+</Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={styles.confidenceButton} 
            onPress={() => adjustConfidence(false)}
          >
            <Text style={styles.confidenceText}>-</Text>
          </TouchableOpacity>
          
          <View style={styles.confidenceDisplay}>
            <Text style={styles.confidenceText}>{(objectConfidence * 100).toFixed(0)}%</Text>
          </View>
          
          <TouchableOpacity 
            style={styles.confidenceButton} 
            onPress={() => adjustConfidence(true)}
          >
            <Text style={styles.confidenceText}>+</Text>
          </TouchableOpacity>
        </View>

        {/* Status Indicator */}
        <View style={styles.statusIndicator}>
          <Text style={styles.statusText}>
            Auto-scan: {autoScanEnabled ? 'ON' : 'OFF'} | Captures: {captureCount}
          </Text>
          <Text style={styles.statusSubText}>
            Status: {isProcessing ? 'Processing...' : 'Scanning'}
            {responseTime > 0 && ` | Response: ${responseTime}ms`}
          </Text>
          {lastResponse && (
            <Text style={styles.statusSubText}>
              Last: {lastResponse} | Interval: {(scanInterval / 1000).toFixed(1)}s
            </Text>
          )}
        </View>

        {/* Controls */}
        <View style={styles.controls}>
          <TouchableOpacity
            style={[styles.button, styles.captureButton, isProcessing && styles.disabledButton]}
            onPress={takePicture}
            disabled={isProcessing}
          >
            {isProcessing ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.buttonText}>📸 Manual</Text>
            )}
          </TouchableOpacity>

          {sound && (
            <TouchableOpacity
              style={[styles.button, styles.stopButton]}
              onPress={stopAudio}
            >
              <Text style={styles.buttonText}>⏹️ Stop Audio</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Results */}
        {caption ? (
          <View style={styles.resultContainer}>
            <Text style={styles.captionTitle}>AI Description:</Text>
            <Text style={styles.captionText}>{caption}</Text>
            
            <View style={styles.statsContainer}>
              <Text style={styles.statsText}>
                Total Captures: {captureCount} | Queue: {requestQueueRef.current.length}
              </Text>
              {responseTime > 0 && (
                <Text style={styles.statsText}>
                  Last Response Time: {responseTime}ms
                </Text>
              )}
            </View>
            
            <View style={styles.audioControls}>
              {audioFile && (
                <TouchableOpacity
                  style={styles.audioButton}
                  onPress={() => playAudio(audioFile)}
                >
                  <Text style={styles.audioButtonText}>🔊 Play Audio</Text>
                </TouchableOpacity>
              )}
              {sound && (
                <TouchableOpacity
                  style={[styles.audioButton, styles.stopAudioButton]}
                  onPress={stopAudio}
                >
                  <Text style={styles.audioButtonText}>⏹️ Stop</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        ) : (
          <View style={styles.instructionContainer}>
            <Text style={styles.instructionText}>
              {autoScanEnabled 
                ? '🔍 Automatic scanning active - describing your environment...' 
                : 'Auto-scan paused - tap the red dot to start'}
            </Text>
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'black',
  },
  camera: {
    flex: 1,
  },
  webview: {
    flex: 1,
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'flex-end',
    padding: 20,
  },
  flipButton: {
    position: 'absolute',
    top: 60,
    right: 20,
    backgroundColor: 'rgba(0,0,0,0.6)',
    padding: 15,
    borderRadius: 50,
  },
  mediaPipeButton: {
    position: 'absolute',
    top: 60,
    right: 80,
    backgroundColor: 'rgba(0,0,0,0.6)',
    padding: 15,
    borderRadius: 50,
  },
  flipText: {
    fontSize: 24,
    color: 'white',
  },
  mediaPipeText: {
    fontSize: 24,
    color: 'white',
  },
  // Auto-scan controls
  autoScanControls: {
    position: 'absolute',
    top: 120,
    right: 20,
    backgroundColor: 'rgba(0,0,0,0.6)',
    padding: 10,
    borderRadius: 10,
    flexDirection: 'row',
    alignItems: 'center',
  },
  autoScanButton: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    padding: 8,
    borderRadius: 20,
    marginRight: 10,
  },
  autoScanActive: {
    backgroundColor: 'rgba(255,0,0,0.6)',
  },
  autoScanText: {
    fontSize: 16,
    color: 'white',
  },
  intervalButton: {
    backgroundColor: 'rgba(255,255,255,0.3)',
    padding: 5,
    borderRadius: 15,
    width: 30,
    height: 30,
    justifyContent: 'center',
    alignItems: 'center',
    marginHorizontal: 2,
  },
  intervalDisplay: {
    paddingHorizontal: 8,
    minWidth: 40,
    alignItems: 'center',
  },
  intervalText: {
    color: 'white',
    fontSize: 12,
    fontWeight: 'bold',
  },
  confidenceButton: {
    backgroundColor: 'rgba(255,255,255,0.3)',
    padding: 5,
    borderRadius: 15,
    width: 30,
    height: 30,
    justifyContent: 'center',
    alignItems: 'center',
    marginHorizontal: 2,
    marginLeft: 8,
  },
  confidenceDisplay: {
    paddingHorizontal: 8,
    minWidth: 35,
    alignItems: 'center',
  },
  confidenceText: {
    color: 'white',
    fontSize: 12,
    fontWeight: 'bold',
  },
  statusIndicator: {
    position: 'absolute',
    top: 60,
    left: 20,
    backgroundColor: 'rgba(0,0,0,0.6)',
    padding: 10,
    borderRadius: 8,
    maxWidth: 200,
  },
  statusText: {
    color: 'white',
    fontSize: 12,
    fontWeight: 'bold',
  },
  statusSubText: {
    color: '#ccc',
    fontSize: 10,
    marginTop: 2,
  },
  controls: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    marginBottom: 30,
  },
  button: {
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: 25,
    paddingVertical: 15,
    borderRadius: 50,
    borderWidth: 2,
    borderColor: '#fff',
    minWidth: 80,
    alignItems: 'center',
    justifyContent: 'center',
  },
  captureButton: {
    backgroundColor: 'rgba(255,255,255,0.3)',
    paddingHorizontal: 30,
    paddingVertical: 20,
  },
  recordingButton: {
    backgroundColor: 'rgba(255,0,0,0.6)',
  },
  stopButton: {
    backgroundColor: 'rgba(255,100,0,0.6)',
  },
  disabledButton: {
    opacity: 0.5,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  resultContainer: {
    backgroundColor: 'rgba(0,0,0,0.7)',
    padding: 15,
    borderRadius: 10,
    marginBottom: 20,
  },
  captionTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 10,
  },
  captionText: {
    color: '#fff',
    fontSize: 16,
    lineHeight: 22,
  },
  statsContainer: {
    marginTop: 10,
    padding: 8,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 5,
  },
  statsText: {
    color: '#ccc',
    fontSize: 12,
    textAlign: 'center',
    marginVertical: 2,
  },
  audioControls: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 10,
  },
  audioButton: {
    backgroundColor: '#4CAF50',
    padding: 12,
    borderRadius: 8,
    flex: 1,
    marginHorizontal: 5,
    alignItems: 'center',
  },
  stopAudioButton: {
    backgroundColor: '#f44336',
  },
  audioButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 'bold',
  },
  message: {
    textAlign: 'center',
    paddingBottom: 10,
    color: 'white',
    fontSize: 16,
  },
  instructionContainer: {
    backgroundColor: 'rgba(0,0,0,0.5)',
    padding: 15,
    borderRadius: 10,
    marginBottom: 20,
    alignItems: 'center',
  },
  instructionText: {
    color: '#fff',
    fontSize: 14,
    textAlign: 'center',
  },
  // WebView styles
  webviewControls: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(0,0,0,0.8)',
    padding: 15,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  closeButton: {
    backgroundColor: '#f44336',
    padding: 12,
    borderRadius: 8,
  },
  closeButtonText: {
    color: 'white',
    fontWeight: 'bold',
  },
  objectsContainer: {
    backgroundColor: 'rgba(255,255,255,0.9)',
    padding: 10,
    borderRadius: 8,
    maxWidth: 200,
  },
  objectsTitle: {
    fontWeight: 'bold',
    marginBottom: 5,
  },
  objectText: {
    fontSize: 12,
    marginVertical: 1,
  },
  loadingContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'white',
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
  },
});