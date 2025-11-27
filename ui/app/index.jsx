// import axios from 'axios';
// import { Audio } from 'expo-av';
// import { CameraView, useCameraPermissions } from 'expo-camera';
// import { useEffect, useRef, useState } from 'react';
// import {
//   ActivityIndicator,
//   Alert,
//   StyleSheet,
//   Text,
//   TouchableOpacity,
//   View,
// } from 'react-native';

// const API_BASE_URL = 'http://192.168.43.198:8000';

// export default function App() {
//   const camera = useRef(null);
//   const [facing, setFacing] = useState('back');
//   const [permission, requestPermission] = useCameraPermissions();
//   const [sound, setSound] = useState();
  
//   const [isRecording, setIsRecording] = useState(false);
//   const [caption, setCaption] = useState('');
//   const [loading, setLoading] = useState(false);
//   const [audioFile, setAudioFile] = useState(null);
//   const [isAutoCaptureEnabled, setIsAutoCaptureEnabled] = useState(false);
//   const captureIntervalRef = useRef(null);
//   const [captureCount, setCaptureCount] = useState(0);
//   const [lastResponse, setLastResponse] = useState(null);

//   // Configure audio mode on component mount
//   useEffect(() => {
//     const setupAudio = async () => {
//       await Audio.setAudioModeAsync({
//         allowsRecordingIOS: false,
//         playsInSilentModeIOS: true,
//         shouldDuckAndroid: true,
//         playThroughEarpieceAndroid: false,
//         staysActiveInBackground: false,
//       });
//     };
    
//     setupAudio();
//   }, []);

//   // Clean up sound on unmount
//   useEffect(() => {
//     return sound
//       ? () => {
//           console.log('Unloading Sound');
//           sound.unloadAsync();
//         }
//       : undefined;
//   }, [sound]);

//   // Request camera permissions
//   useEffect(() => {
//     if (!permission?.granted) {
//       requestPermission();
//     }
//   }, [permission]);

//   // Start/stop continuous capture
//   useEffect(() => {
//     if (isAutoCaptureEnabled) {
//       startContinuousCapture();
//     } else {
//       stopContinuousCapture();
//     }

//     return () => {
//       stopContinuousCapture();
//     };
//   }, [isAutoCaptureEnabled]);

//   const startContinuousCapture = () => {
//     console.log('Starting continuous capture every 50ms');
//     setCaptureCount(0);
    
//     captureIntervalRef.current = setInterval(() => {
//       handleAutoCapture();
//     }, 50); // 50ms = 0.05 seconds
//   };

//   const stopContinuousCapture = () => {
//     if (captureIntervalRef.current) {
//       console.log('Stopping continuous capture');
//       clearInterval(captureIntervalRef.current);
//       captureIntervalRef.current = null;
//     }
//   };

//   const handleAutoCapture = async () => {
//     if (camera.current && !loading) {
//       try {
//         setLoading(true);
        
//         const photo = await camera.current.takePictureAsync({
//           quality: 0.5, // Lower quality for faster processing
//           base64: false,
//           skipProcessing: true, // Skip processing for faster capture
//           exif: false, // Disable EXIF for faster capture
//         });

//         console.log(`Auto-captured photo ${captureCount + 1}:`, photo.uri);
//         setCaptureCount(prev => prev + 1);
//         await uploadImage(photo.uri);
        
//       } catch (error) {
//         console.error('Error in auto capture:', error);
//         setLoading(false);
//       }
//     }
//   };

//   const takePicture = async () => {
//     if (camera.current) {
//       try {
//         setLoading(true);
//         const photo = await camera.current.takePictureAsync({
//           quality: 0.7,
//           base64: false,
//           skipProcessing: false,
//         });

//         console.log('Manual photo taken:', photo.uri);
//         await uploadImage(photo.uri);
//       } catch (error) {
//         console.error('Error taking picture:', error);
//         Alert.alert('Error', 'Failed to take picture');
//         setLoading(false);
//       }
//     }
//   };

//   const uploadImage = async (imageUri) => {
//     try {
//       const formData = new FormData();
//       formData.append('file', {
//         uri: imageUri,
//         type: 'image/jpeg',
//         name: `photo_${Date.now()}.jpg`,
//       });

//       console.log('Uploading image to:', `${API_BASE_URL}/caption`);
//       const response = await axios.post(`${API_BASE_URL}/caption`, formData, {
//         headers: {
//           'Content-Type': 'multipart/form-data',
//         },
//         timeout: 10000, // Reduced timeout for faster failure
//       });

//       console.log('Response received:', response.data);
//       setCaption(response.data.caption);
//       setAudioFile(response.data.audio_file);
//       setLastResponse(new Date().toLocaleTimeString());
      
//       // Auto-play the audio only for significant changes
//       if (response.data.audio_file && shouldPlayAudio(response.data.caption)) {
//         await playAudio(response.data.audio_file);
//       }

//     } catch (error) {
//       console.error('Upload error:', error);
//       // Don't show alerts for continuous mode to avoid spam
//       if (!isAutoCaptureEnabled) {
//         if (error.response) {
//           Alert.alert('Server Error', `Server responded with status ${error.response.status}`);
//         } else if (error.request) {
//           Alert.alert(
//             'Connection Error', 
//             `Cannot connect to server at ${API_BASE_URL}. Make sure your server is running and accessible from this network.`
//           );
//         } else {
//           Alert.alert('Error', `Failed to process image: ${error.message}`);
//         }
//       }
//     } finally {
//       setLoading(false);
//     }
//   };

//   // Simple logic to prevent audio spam - only play for significantly different captions
//   const shouldPlayAudio = (newCaption) => {
//     if (!caption) return true;
    
//     // Only play audio if caption is substantially different
//     const words1 = caption.toLowerCase().split(' ');
//     const words2 = newCaption.toLowerCase().split(' ');
//     const commonWords = words1.filter(word => words2.includes(word));
//     const similarity = commonWords.length / Math.max(words1.length, words2.length);
    
//     return similarity < 0.7; // Play audio only if less than 70% similar
//   };

//   const playAudio = async (filename) => {
//     try {
//       const audioUrl = `${API_BASE_URL}/audio/${filename}`;
//       console.log('Playing audio from:', audioUrl);

//       // Stop any currently playing sound
//       if (sound) {
//         await sound.stopAsync();
//         await sound.unloadAsync();
//       }

//       // Load and play the new sound
//       const { sound: newSound } = await Audio.Sound.createAsync(
//         { uri: audioUrl },
//         { shouldPlay: true }
//       );
      
//       setSound(newSound);

//       newSound.setOnPlaybackStatusUpdate((status) => {
//         if (status.didJustFinish) {
//           console.log('Audio finished playing');
//         }
//       });

//     } catch (error) {
//       console.error('Error playing audio:', error);
//       if (!isAutoCaptureEnabled) {
//         Alert.alert('Audio Error', 'Failed to play audio description.');
//       }
//     }
//   };

//   const stopAudio = async () => {
//     if (sound) {
//       await sound.stopAsync();
//       await sound.unloadAsync();
//       setSound(null);
//     }
//   };

//   const toggleCameraFacing = () => {
//     setFacing(current => (current === 'back' ? 'front' : 'back'));
//   };

//   const startTracking = () => {
//     setIsRecording(true);
//     setIsAutoCaptureEnabled(true);
//     Alert.alert('Continuous Capture Started', 'Camera will capture every 50ms');
//   };

//   const stopTracking = () => {
//     setIsRecording(false);
//     setIsAutoCaptureEnabled(false);
//     Alert.alert('Continuous Capture Stopped', 'Automatic capture disabled');
//   };

//   const handleCameraReady = () => {
//     console.log('Camera is ready');
//   };

//   const handleCameraError = (error) => {
//     console.error('Camera error:', error);
//   };

//   if (!permission) {
//     return (
//       <View style={styles.container}>
//         <Text style={styles.message}>Requesting camera permission...</Text>
//       </View>
//     );
//   }

//   if (!permission.granted) {
//     return (
//       <View style={styles.container}>
//         <Text style={styles.message}>We need your permission to use the camera</Text>
//         <TouchableOpacity style={styles.button} onPress={requestPermission}>
//           <Text style={styles.buttonText}>Grant Permission</Text>
//         </TouchableOpacity>
//       </View>
//     );
//   }

//   return (
//     <View style={styles.container}>
//       <CameraView
//         ref={camera}
//         style={styles.camera}
//         facing={facing}
//         mode="picture"
//         zoom={0}
//         onCameraReady={handleCameraReady}
//         onMountError={handleCameraError}
//       />
      
//       <View style={styles.overlay}>
//         {/* Camera Flip Button */}
//         <TouchableOpacity style={styles.flipButton} onPress={toggleCameraFacing}>
//           <Text style={styles.flipText}>🔄</Text>
//         </TouchableOpacity>

//         {/* Status Indicator */}
//         {isAutoCaptureEnabled && (
//           <View style={styles.statusIndicator}>
//             <Text style={styles.statusText}>
//               Continuous Mode: {captureCount} captures
//             </Text>
//             {lastResponse && (
//               <Text style={styles.statusSubText}>
//                 Last response: {lastResponse}
//               </Text>
//             )}
//           </View>
//         )}

//         {/* Controls */}
//         <View style={styles.controls}>
//           <TouchableOpacity
//             style={[styles.button, isRecording && styles.recordingButton]}
//             onPress={isRecording ? stopTracking : startTracking}
//             disabled={loading}
//           >
//             <Text style={styles.buttonText}>
//               {isRecording ? 'Stop Auto' : 'Start Auto'}
//             </Text>
//           </TouchableOpacity>

//           <TouchableOpacity
//             style={[styles.button, styles.captureButton]}
//             onPress={takePicture}
//             disabled={loading || isAutoCaptureEnabled}
//           >
//             {loading ? (
//               <ActivityIndicator color="#fff" />
//             ) : (
//               <Text style={styles.buttonText}>📸</Text>
//             )}
//           </TouchableOpacity>

//           {sound && (
//             <TouchableOpacity
//               style={[styles.button, styles.stopButton]}
//               onPress={stopAudio}
//             >
//               <Text style={styles.buttonText}>⏹️</Text>
//             </TouchableOpacity>
//           )}
//         </View>

//         {/* Results */}
//         {caption ? (
//           <View style={styles.resultContainer}>
//             <Text style={styles.captionTitle}>AI Description:</Text>
//             <Text style={styles.captionText}>{caption}</Text>
            
//             <View style={styles.statsContainer}>
//               <Text style={styles.statsText}>
//                 Captures: {captureCount} | Last: {lastResponse}
//               </Text>
//             </View>
            
//             <View style={styles.audioControls}>
//               {audioFile && (
//                 <TouchableOpacity
//                   style={styles.audioButton}
//                   onPress={() => playAudio(audioFile)}
//                 >
//                   <Text style={styles.audioButtonText}>🔊 Play Audio</Text>
//                 </TouchableOpacity>
//               )}
//               {sound && (
//                 <TouchableOpacity
//                   style={[styles.audioButton, styles.stopAudioButton]}
//                   onPress={stopAudio}
//                 >
//                   <Text style={styles.audioButtonText}>⏹️ Stop</Text>
//                 </TouchableOpacity>
//               )}
//             </View>
//           </View>
//         ) : (
//           <View style={styles.instructionContainer}>
//             <Text style={styles.instructionText}>
//               {isAutoCaptureEnabled 
//                 ? 'Continuous capture active - 50ms interval' 
//                 : 'Tap the camera icon to capture and describe'}
//             </Text>
//           </View>
//         )}
//       </View>
//     </View>
//   );
// }

// const styles = StyleSheet.create({
//   container: {
//     flex: 1,
//     backgroundColor: 'black',
//   },
//   camera: {
//     flex: 1,
//   },
//   overlay: {
//     ...StyleSheet.absoluteFillObject,
//     justifyContent: 'flex-end',
//     padding: 20,
//   },
//   flipButton: {
//     position: 'absolute',
//     top: 60,
//     right: 20,
//     backgroundColor: 'rgba(0,0,0,0.6)',
//     padding: 15,
//     borderRadius: 50,
//   },
//   flipText: {
//     fontSize: 24,
//     color: 'white',
//   },
//   statusIndicator: {
//     position: 'absolute',
//     top: 60,
//     left: 20,
//     backgroundColor: 'rgba(0,0,0,0.6)',
//     padding: 10,
//     borderRadius: 8,
//   },
//   statusText: {
//     color: 'white',
//     fontSize: 12,
//     fontWeight: 'bold',
//   },
//   statusSubText: {
//     color: '#ccc',
//     fontSize: 10,
//     marginTop: 2,
//   },
//   controls: {
//     flexDirection: 'row',
//     justifyContent: 'space-around',
//     alignItems: 'center',
//     marginBottom: 30,
//   },
//   button: {
//     backgroundColor: 'rgba(0,0,0,0.6)',
//     paddingHorizontal: 25,
//     paddingVertical: 15,
//     borderRadius: 50,
//     borderWidth: 2,
//     borderColor: '#fff',
//     minWidth: 80,
//     alignItems: 'center',
//     justifyContent: 'center',
//   },
//   captureButton: {
//     backgroundColor: 'rgba(255,255,255,0.3)',
//     paddingHorizontal: 30,
//     paddingVertical: 20,
//   },
//   recordingButton: {
//     backgroundColor: 'rgba(255,0,0,0.6)',
//   },
//   stopButton: {
//     backgroundColor: 'rgba(255,100,0,0.6)',
//   },
//   buttonText: {
//     color: '#fff',
//     fontSize: 16,
//     fontWeight: 'bold',
//   },
//   resultContainer: {
//     backgroundColor: 'rgba(0,0,0,0.7)',
//     padding: 15,
//     borderRadius: 10,
//     marginBottom: 20,
//   },
//   captionTitle: {
//     color: '#fff',
//     fontSize: 18,
//     fontWeight: 'bold',
//     marginBottom: 10,
//   },
//   captionText: {
//     color: '#fff',
//     fontSize: 16,
//     lineHeight: 22,
//   },
//   statsContainer: {
//     marginTop: 10,
//     padding: 8,
//     backgroundColor: 'rgba(255,255,255,0.1)',
//     borderRadius: 5,
//   },
//   statsText: {
//     color: '#ccc',
//     fontSize: 12,
//     textAlign: 'center',
//   },
//   audioControls: {
//     flexDirection: 'row',
//     justifyContent: 'space-between',
//     marginTop: 10,
//   },
//   audioButton: {
//     backgroundColor: '#4CAF50',
//     padding: 12,
//     borderRadius: 8,
//     flex: 1,
//     marginHorizontal: 5,
//     alignItems: 'center',
//   },
//   stopAudioButton: {
//     backgroundColor: '#f44336',
//   },
//   audioButtonText: {
//     color: '#fff',
//     fontSize: 14,
//     fontWeight: 'bold',
//   },
//   message: {
//     textAlign: 'center',
//     paddingBottom: 10,
//     color: 'white',
//     fontSize: 16,
//   },
//   instructionContainer: {
//     backgroundColor: 'rgba(0,0,0,0.5)',
//     padding: 15,
//     borderRadius: 10,
//     marginBottom: 20,
//     alignItems: 'center',
//   },
//   instructionText: {
//     color: '#fff',
//     fontSize: 14,
//     textAlign: 'center',
//   },
// });

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
  const [isAutoCaptureEnabled, setIsAutoCaptureEnabled] = useState(false);
  const captureIntervalRef = useRef(null);
  const [captureCount, setCaptureCount] = useState(0);
  const [lastResponse, setLastResponse] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const requestQueueRef = useRef([]);
  const [responseTime, setResponseTime] = useState(0);

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

  // Process queue when not processing
  useEffect(() => {
    if (!isProcessing && requestQueueRef.current.length > 0 && isAutoCaptureEnabled) {
      processNextInQueue();
    }
  }, [isProcessing, isAutoCaptureEnabled]);

  const startContinuousCapture = () => {
    console.log('Starting continuous capture - waiting for responses');
    setCaptureCount(0);
    requestQueueRef.current = [];
    
    captureIntervalRef.current = setInterval(() => {
      if (!isProcessing) {
        handleAutoCapture();
      }
    }, 100); // Check every 100ms if ready for next capture
  };

  const stopContinuousCapture = () => {
    if (captureIntervalRef.current) {
      console.log('Stopping continuous capture');
      clearInterval(captureIntervalRef.current);
      captureIntervalRef.current = null;
      requestQueueRef.current = [];
      setIsProcessing(false);
    }
  };

  const handleAutoCapture = async () => {
    if (camera.current && !isProcessing && isAutoCaptureEnabled) {
      try {
        const photo = await camera.current.takePictureAsync({
          quality: 0.5,
          base64: false,
          skipProcessing: true,
          exif: false,
        });

        console.log(`Captured photo ${captureCount + 1}:`, photo.uri);
        
        // Add to queue and process immediately if not processing
        requestQueueRef.current.push(photo.uri);
        setCaptureCount(prev => prev + 1);
        
        if (!isProcessing) {
          processNextInQueue();
        }
        
      } catch (error) {
        console.error('Error in auto capture:', error);
      }
    }
  };

  const processNextInQueue = async () => {
    if (requestQueueRef.current.length === 0 || isProcessing || !isAutoCaptureEnabled) {
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

      console.log('Uploading image to:', `${API_BASE_URL}/caption`);
      const response = await axios.post(`${API_BASE_URL}/caption`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
        timeout: 30000,
      });

      const endTime = Date.now();
      const responseTimeMs = endTime - startTime;
      setResponseTime(responseTimeMs);

      console.log('Response received:', response.data);
      setCaption(response.data.caption);
      setAudioFile(response.data.audio_file);
      setLastResponse(new Date().toLocaleTimeString());
      
      // Auto-play the audio only for significant changes
      if (response.data.audio_file && shouldPlayAudio(response.data.caption)) {
        await playAudio(response.data.audio_file);
      }

    } catch (error) {
      console.error('Upload error:', error);
      const endTime = Date.now();
      setResponseTime(endTime - startTime);
      
      if (!isAutoCaptureEnabled) {
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
      
      // Process next in queue after a brief delay
      setTimeout(() => {
        if (isAutoCaptureEnabled) {
          processNextInQueue();
        }
      }, 100);
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
      console.log('Playing audio from:', audioUrl);

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
      if (!isAutoCaptureEnabled) {
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

  const startTracking = () => {
    setIsRecording(true);
    setIsAutoCaptureEnabled(true);
    Alert.alert('Continuous Capture Started', 'Camera will capture and wait for responses');
  };

  const stopTracking = () => {
    setIsRecording(false);
    setIsAutoCaptureEnabled(false);
    Alert.alert('Continuous Capture Stopped', 'Automatic capture disabled');
  };

  const handleCameraReady = () => {
    console.log('Camera is ready');
  };

  const handleCameraError = (error) => {
    console.error('Camera error:', error);
  };

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

        {/* Status Indicator */}
        {isAutoCaptureEnabled && (
          <View style={styles.statusIndicator}>
            <Text style={styles.statusText}>
              Captures: {captureCount} | Queue: {requestQueueRef.current.length}
            </Text>
            <Text style={styles.statusSubText}>
              Status: {isProcessing ? 'Processing...' : 'Ready'}
              {responseTime > 0 && ` | Response: ${responseTime}ms`}
            </Text>
            {lastResponse && (
              <Text style={styles.statusSubText}>
                Last: {lastResponse}
              </Text>
            )}
          </View>
        )}

        {/* Controls */}
        <View style={styles.controls}>
          <TouchableOpacity
            style={[styles.button, isRecording && styles.recordingButton]}
            onPress={isRecording ? stopTracking : startTracking}
            disabled={isProcessing}
          >
            <Text style={styles.buttonText}>
              {isRecording ? 'Stop Auto' : 'Start Auto'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.button, styles.captureButton, (isProcessing || isAutoCaptureEnabled) && styles.disabledButton]}
            onPress={takePicture}
            disabled={isProcessing || isAutoCaptureEnabled}
          >
            {isProcessing ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.buttonText}>📸</Text>
            )}
          </TouchableOpacity>

          {sound && (
            <TouchableOpacity
              style={[styles.button, styles.stopButton]}
              onPress={stopAudio}
            >
              <Text style={styles.buttonText}>⏹️</Text>
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
              {isAutoCaptureEnabled 
                ? 'Continuous capture active - waiting for responses' 
                : 'Tap the camera icon to capture and describe'}
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
  flipText: {
    fontSize: 24,
    color: 'white',
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
});