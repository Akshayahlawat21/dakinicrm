import React, { createContext, useContext, useState, useRef, useEffect, useCallback } from 'react';
import { Room, RoomEvent, Track, createLocalAudioTrack } from 'livekit-client';
import {
  getTelephonyConfig,
  mintTelephonyToken,
  initiateOutboundCall,
  hangupCall,
  getRoomStatus,
  sendDTMFTone as apiSendDTMF,
  controlCall,
  mergeCallApi,
} from '../services/telephonyApi';

// Standard ITU DTMF frequency table (dual sine waves)
const DTMF_FREQS = {
  '1': [697, 1209], '2': [697, 1336], '3': [697, 1477],
  '4': [770, 1209], '5': [770, 1336], '6': [770, 1477],
  '7': [852, 1209], '8': [852, 1336], '9': [852, 1477],
  '*': [941, 1209], '0': [941, 1336], '#': [941, 1477],
};

export function playDTMFSound(digit) {
  try {
    const freqs = DTMF_FREQS[digit];
    if (!freqs) return;
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const osc1 = ctx.createOscillator();
    const osc2 = ctx.createOscillator();
    const gain = ctx.createGain();

    osc1.frequency.value = freqs[0];
    osc2.frequency.value = freqs[1];

    gain.gain.setValueAtTime(0.12, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.14);

    osc1.connect(gain);
    osc2.connect(gain);
    gain.connect(ctx.destination);

    osc1.start();
    osc2.start();
    osc1.stop(ctx.currentTime + 0.15);
    osc2.stop(ctx.currentTime + 0.15);
    setTimeout(() => ctx.close().catch(() => {}), 200);
  } catch (err) {
    // Non-blocking Web Audio fallback
  }
}

const CallContext = createContext(null);

export function CallProvider({ children }) {
  // Call States: 'idle' | 'connecting' | 'dialing' | 'ringing' | 'connected' | 'completed' | 'failed'
  const [callState, setCallState] = useState('idle');
  const [activeCall, setActiveCall] = useState(null);
  const [callDuration, setCallDuration] = useState(0);

  // Audio / Hardware States
  const [isMuted, setIsMuted] = useState(false);
  const [isMicActive, setIsMicActive] = useState(false);
  const [micPermission, setMicPermission] = useState('prompt'); // 'prompt' | 'granted' | 'denied' | 'unsupported'
  const [liveKitConnected, setLiveKitConnected] = useState(false);
  const [pstnConnected, setPstnConnected] = useState(false);

  // UI States
  const [isDialerOpen, setIsDialerOpen] = useState(false);
  const [dialerPrefill, setDialerPrefill] = useState({ phoneNumber: '', contactName: '', leadId: null });
  const [errorMessage, setErrorMessage] = useState(null);
  const [notification, setNotification] = useState(null);
  const [dtmfHistory, setDtmfHistory] = useState('');
  const [isOnHold, setIsOnHold] = useState(false);

  // Refs for WebRTC & intervals
  const livekitRoomRef = useRef(null);
  const localAudioTrackRef = useRef(null);
  const remoteAudioElementsRef = useRef([]);
  const pollIntervalRef = useRef(null);
  const timerIntervalRef = useRef(null);
  const activeCallRef = useRef(null);
  activeCallRef.current = activeCall;

  // Cleanup helper
  const cleanupResources = useCallback(() => {
    // 1. Clear intervals
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
      pollIntervalRef.current = null;
    }
    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current);
      timerIntervalRef.current = null;
    }

    // 2. Stop and release local microphone track
    if (localAudioTrackRef.current) {
      try {
        localAudioTrackRef.current.stop();
      } catch (err) {
        console.warn('Error stopping local audio track:', err);
      }
      localAudioTrackRef.current = null;
    }
    setIsMicActive(false);
    setIsMuted(false);

    // 3. Remove remote audio elements from DOM
    remoteAudioElementsRef.current.forEach((el) => {
      try {
        el.pause();
        el.srcObject = null;
        el.remove();
      } catch {
        // element may already be detached
      }
    });
    remoteAudioElementsRef.current = [];

    // 4. Disconnect LiveKit Room
    if (livekitRoomRef.current) {
      try {
        livekitRoomRef.current.disconnect();
      } catch (err) {
        console.warn('Error disconnecting LiveKit room:', err);
      }
      livekitRoomRef.current = null;
    }

    setLiveKitConnected(false);
    setPstnConnected(false);
  }, []);

  // Handle call termination
  const endCall = useCallback(async () => {
    const current = activeCallRef.current;
    setCallState('completed');

    if (current?.room) {
      try {
        await hangupCall({
          room: current.room,
          callId: current.callId,
          leadId: current.leadId,
        });
      } catch (err) {
        console.warn('Hangup API call failed:', err);
      }
    }

    cleanupResources();

    // Reset to idle after short delay to display "Call ended"
    setTimeout(() => {
      setCallState('idle');
      setActiveCall(null);
      setCallDuration(0);
      setErrorMessage(null);
    }, 1200);
  }, [cleanupResources]);

  // Immediate dismiss/reset
  const dismissCall = useCallback(() => {
    cleanupResources();
    setCallState('idle');
    setActiveCall(null);
    setCallDuration(0);
    setErrorMessage(null);
  }, [cleanupResources]);

  // Handle sudden remote disconnect
  const handleRemoteDisconnect = useCallback(() => {
    cleanupResources();
    setCallState('completed');
    setTimeout(() => {
      setCallState('idle');
      setActiveCall(null);
      setCallDuration(0);
    }, 1800);
  }, [cleanupResources]);

  // Duration timer effect when connected
  useEffect(() => {
    if (callState === 'connected') {
      timerIntervalRef.current = setInterval(() => {
        setCallDuration((prev) => prev + 1);
      }, 1000);
    } else {
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
        timerIntervalRef.current = null;
      }
    }
    return () => {
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
        timerIntervalRef.current = null;
      }
    };
  }, [callState]);

  // Room status poller
  useEffect(() => {
    if (!activeCall?.room || !['connecting', 'dialing', 'ringing', 'connected'].includes(callState)) {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
        pollIntervalRef.current = null;
      }
      return;
    }

    const poll = async () => {
      try {
        const status = await getRoomStatus(activeCall.room);
        if (status.pstn_connected) {
          setPstnConnected(true);
          setCallState((st) => (st !== 'connected' && st !== 'completed' ? 'connected' : st));
        } else if (callState === 'connected' && !status.exists) {
          // Room disappeared, customer hung up
          handleRemoteDisconnect();
        }
      } catch (err) {
        console.debug('Room status poll skipped:', err);
      }
    };

    pollIntervalRef.current = setInterval(poll, 2000);
    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
        pollIntervalRef.current = null;
      }
    };
  }, [activeCall?.room, callState, handleRemoteDisconnect]);

  // Initiate call workflow
  const startCall = useCallback(
    async ({ phoneNumber, leadId = null, contactName = null }) => {
      if (!phoneNumber || !String(phoneNumber).trim()) {
        setErrorMessage('Cannot call: Missing phone number.');
        return;
      }

      if (callState !== 'idle' && callState !== 'completed' && callState !== 'failed') {
        setErrorMessage('A call is already active. Please hang up before starting a new call.');
        return;
      }

      setErrorMessage(null);
      setCallDuration(0);
      setCallState('connecting');

      // Set activeCall early so the panel shows lead name/number during connection
      const callRoom = `crm_room_${Math.random().toString(36).substring(2, 10)}`;
      setActiveCall({
        callId: null,
        room: callRoom,
        toNumber: phoneNumber,
        fromNumber: null,
        leadId: leadId,
        contactName: contactName || 'Contact',
        mode: 'HUMAN_ONLY',
        startedAt: new Date().toISOString(),
      });

      // 1. Microphone access check
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        setMicPermission('unsupported');
        setCallState('failed');
        setErrorMessage('Your browser does not support WebRTC microphone audio.');
        return;
      }

      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        stream.getTracks().forEach((track) => track.stop());
        setMicPermission('granted');
      } catch (err) {
        setMicPermission('denied');
        setCallState('failed');
        setErrorMessage('Microphone access was denied. Please allow microphone permissions in your browser to speak with the customer.');
        return;
      }

      try {

        // Step 1: Obtain LiveKit token for this unique room
        let tokenInfo;
        try {
          const tokenRes = await mintTelephonyToken({
            room: callRoom,
            identity: `agent_${Math.random().toString(36).substring(2, 8)}`,
            name: contactName ? `Agent for ${contactName}` : 'CRM Salesperson',
          });
          tokenInfo = tokenRes?.data || tokenRes;
        } catch (tokenErr) {
          throw new Error(`Token generation failed: ${tokenErr.message}`);
        }
        const livekitUrl = tokenInfo?.url || tokenInfo?.server_url || 'wss://telephony-z5x8uya8.livekit.cloud';
        const livekitJwt = tokenInfo?.token;

        if (!livekitJwt) {
          throw new Error('Failed to obtain softphone credentials from telephony service');
        }

        // Step 2: Connect browser softphone to LiveKit room
        const room = new Room({
          adaptiveStream: true,
          dynacast: true,
          audioCaptureDefaults: {
            autoGainControl: true,
            echoCancellation: true,
            noiseSuppression: true,
          },
        });
        livekitRoomRef.current = room;

        room.on(RoomEvent.Connected, () => {
          setLiveKitConnected(true);
        });

        room.on(RoomEvent.ParticipantConnected, (participant) => {
          const identity = participant.identity || '';
          if (identity.startsWith('pstn-')) {
            setPstnConnected(true);
            setCallState('connected');
          }
        });

        room.on(RoomEvent.TrackSubscribed, (track, publication, participant) => {
          if (track.kind === Track.Kind.Audio) {
            const el = track.attach();
            el.id = `remote-audio-${participant.identity}`;
            document.body.appendChild(el);
            remoteAudioElementsRef.current.push(el);
            setPstnConnected(true);
            setCallState('connected');
          }
        });

        room.on(RoomEvent.TrackUnsubscribed, (track) => {
          track.detach().forEach((el) => {
            el.remove();
            remoteAudioElementsRef.current = remoteAudioElementsRef.current.filter((e) => e !== el);
          });
        });

        room.on(RoomEvent.Disconnected, () => {
          setLiveKitConnected(false);
          handleRemoteDisconnect();
        });

        try {
          await room.connect(livekitUrl, livekitJwt);
        } catch (connectErr) {
          throw new Error(`LiveKit WebRTC connection failed: ${connectErr.message}`);
        }

        // Step 3: Create and publish salesperson's local microphone audio track
        try {
          const localTrack = await createLocalAudioTrack({
            echoCancellation: true,
            noiseSuppression: true,
          });
          localAudioTrackRef.current = localTrack;
          await room.localParticipant.publishTrack(localTrack);
          setIsMicActive(true);
        } catch (micErr) {
          console.warn('Microphone audio track publishing warning:', micErr);
          setIsMicActive(false);
        }

        // Step 4: Initiate outbound PSTN call via backend into this established room
        setCallState('dialing');
        let callResult;
        try {
          const rawResult = await initiateOutboundCall({
            toNumber: phoneNumber,
            leadId,
            contactName,
            room: callRoom,
            record: true,
          });
          callResult = rawResult?.data || rawResult;
        } catch (callErr) {
          throw new Error(`PSTN call initiation failed: ${callErr.message}`);
        }

        if (!callResult || (!callResult.success && !callResult.call_id)) {
          throw new Error(callResult?.message || 'Call initiation failed on telephony backend');
        }

        // Update activeCall with real backend data
        setActiveCall((prev) => ({
          ...prev,
          callId: callResult.call_id,
          callUuid: callResult.call_uuid,
          room: callResult.room || callRoom,
          toNumber: callResult.to_number || phoneNumber,
          fromNumber: callResult.from_number,
          leadId: callResult.lead_id || leadId,
          contactName: callResult.contact_name || contactName || prev?.contactName || 'Contact',
          mode: callResult.mode || 'HUMAN_ONLY',
        }));
      } catch (err) {
        console.error('Call setup error:', err);
        cleanupResources();
        setCallState('failed');
        setErrorMessage(err.message || 'Call failed to connect. Please check network connection and try again.');
      }
    },
    [callState, cleanupResources, handleRemoteDisconnect]
  );

  // Toggle Mute
  const toggleMute = useCallback(() => {
    if (!localAudioTrackRef.current) return;
    if (isMuted) {
      localAudioTrackRef.current.unmute();
      setIsMuted(false);
    } else {
      localAudioTrackRef.current.mute();
      setIsMuted(true);
    }
  }, [isMuted]);

  // Send DTMF Digit with tone & state feedback
  const sendDTMF = useCallback(
    async (digit) => {
      // 1. Tangible Audio Feedback
      playDTMFSound(digit);

      // 2. Visual State Tracking
      setDtmfHistory((prev) => (prev + digit).slice(-16));

      // 3. Dispatch to Upstream WebRTC Backend
      if (!activeCall?.room) return;
      try {
        await apiSendDTMF({ room: activeCall.room, digit });
      } catch (err) {
        console.warn('DTMF send error:', err);
      }
    },
    [activeCall?.room]
  );

  const clearDTMFHistory = useCallback(() => {
    setDtmfHistory('');
  }, []);

  // Mid-Call Hold / Resume
  const toggleHold = useCallback(async () => {
    const current = activeCallRef.current;
    if (!current?.callId) return;
    const nextAction = isOnHold ? 'resume' : 'hold';
    try {
      await controlCall({ callId: current.callId, action: nextAction });
      setIsOnHold(!isOnHold);
    } catch (err) {
      console.warn('Hold toggle warning:', err);
      setIsOnHold(!isOnHold);
    }
  }, [isOnHold]);

  // Merge Outbound Call into Active Room Conference
  const mergeCall = useCallback(
    async ({ phoneNumber, contactName = null, leadId = null }) => {
      const current = activeCallRef.current;
      if (!current?.room) {
        throw new Error('No active call room to merge participant into');
      }
      const rawRes = await mergeCallApi({
        room: current.room,
        toNumber: phoneNumber,
        contactName,
        leadId,
      });
      const res = rawRes?.data || rawRes;
      setActiveCall((prev) => ({
        ...prev,
        mergedParticipants: [
          ...(prev?.mergedParticipants || []),
          {
            callId: res?.call_id,
            toNumber: res?.to_number || phoneNumber,
            contactName: contactName || 'Conference Member',
            startedAt: new Date().toISOString(),
          },
        ],
      }));
      return res;
    },
    []
  );

  const openDialer = useCallback((prefillNumber = '', prefillName = '', leadId = null) => {
    setDialerPrefill({
      phoneNumber: prefillNumber,
      contactName: prefillName,
      leadId,
    });
    setIsDialerOpen(true);
  }, []);

  const closeDialer = useCallback(() => {
    setIsDialerOpen(false);
  }, []);

  const clearError = useCallback(() => {
    setErrorMessage(null);
  }, []);

  const showToast = useCallback((msg) => {
    setNotification(msg);
    setTimeout(() => setNotification(null), 4000);
  }, []);

  return (
    <CallContext.Provider
      value={{
        callState,
        activeCall,
        callDuration,
        isMuted,
        isMicActive,
        micPermission,
        liveKitConnected,
        pstnConnected,
        isDialerOpen,
        dialerPrefill,
        errorMessage,
        notification,
        dtmfHistory,
        isOnHold,
        startCall,
        endCall,
        dismissCall,
        toggleMute,
        toggleHold,
        sendDTMF,
        clearDTMFHistory,
        mergeCall,
        openDialer,
        closeDialer,
        clearError,
        showToast,
      }}
    >
      {children}
    </CallContext.Provider>
  );
}

export function useDialer() {
  const context = useContext(CallContext);
  if (!context) {
    throw new Error('useDialer must be used within a CallProvider');
  }
  return context;
}

